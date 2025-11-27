// cricbuzz/index.js — FINAL, STABLE, INNINGS-BASED, DUPLICATE-SAFE VERSION
import dotenv from "dotenv";
dotenv.config();

import generateTweet from "../ai.js";
import { postTweet_console, postTweet_web } from "../twitter.js";

import { createLogger } from "../utils/logger.js";
import { findIndiaMatch, getCommentary, getMatchScore } from "./cricbuzzApi.js";
import {
  detectFour,
  detectMilestone,
  detectPartnership,
  detectSix,
  detectWicket,
} from "./inningsDetector.js";

globalThis.LAST_INNINGS = null;
globalThis.LAST_OVER = null;
globalThis.LAST_BALL = null;

const USE_WEB_TWEET = process.env.USE_WEB_TWEET === "true";

// const FORCE_MATCH_ID = process.env.FORCE_MATCH_ID
//   ? Number(process.env.FORCE_MATCH_ID)
//   : 0;
const FORCE_MATCH_ID = 138919;

let MATCH_ID = FORCE_MATCH_ID || 0;
let MATCH_NAME = FORCE_MATCH_ID ? `Forced Match #${FORCE_MATCH_ID}` : "";

const POLL_WAIT_TIME = 5000;
const log = createLogger("prod");

const wait = (ms) => new Promise((res) => setTimeout(res, ms));

function getCorrectInnings(scoreRes, mini) {
  const card = scoreRes?.scorecard;
  if (!card || card.length === 0) return null;

  // 1) If miniscore explicitly gives inningsid
  if (mini?.inningsid) {
    const byMini = card.find((i) => i.inningsid === mini.inningsid);
    if (byMini) return byMini;
  }

  // 2) Otherwise, pick innings with highest ballnbr (most recent)
  const live = card.reduce((a, b) => (a.ballnbr > b.ballnbr ? a : b));
  return live || card[card.length - 1];
}

function normalizeOvers(overs) {
  if (!overs) return overs;
  const p = overs.toString().split(".");
  const o = parseInt(p[0]);
  const b = parseInt(p[1] || "0");
  return b === 6 ? (o + 1).toFixed(1).replace(".0", "") : overs;
}

function getMiniPlayers(mini = {}) {
  return {
    striker: mini?.batsmanstriker?.name || "",
    nonStriker: mini?.batsmannonstriker?.name || "",
    bowler: mini?.bowlerstriker?.name || "",
    strikerRuns: mini?.batsmanstriker?.runs || "",
    strikerBallsPlayed: mini?.batsmanstriker?.balls || "",
    nonStrikerRuns: mini?.batsmannonstriker?.runs || "",
    nonStrikerBallsPlayed: mini?.batsmannonstriker?.balls || "",
  };
}

function buildMatchContext({ score, comm, currInnings, event }) {
  const mini = comm?.miniscore || {};
  const headers = comm?.matchheaders || {};

  const players = getMiniPlayers(mini);

  const match = {
    name:
      headers?.matchdescription ||
      `${headers?.team1?.teamname || ""} vs ${
        headers?.team2?.teamname || ""
      }`.trim(),
    team1: headers?.team1?.teamname || "",
    team2: headers?.team2?.teamname || "",
    format: headers?.matchformat || "",
    status: headers?.status || "",
    venue: headers?.venue || "",
  };

  const innings = {
    ...currInnings,
    overs: normalizeOvers(currInnings.overs),
  };

  return {
    match,
    innings,
    event,
    players,

    raw: {
      score,
      mini,
    },
  };
}

async function startBot() {
  if (MATCH_ID) {
    log(`🎯 Using forced MATCH_ID: ${MATCH_ID}`);
    pollingLoop();
    return;
  }

  log("🔎 Searching for LIVE India match...");

  while (!MATCH_ID) {
    try {
      const match = await findIndiaMatch();

      if (match) {
        MATCH_ID = match.id;
        MATCH_NAME = match.name;
        log(`✅ Found LIVE match: ${MATCH_NAME}`);
        break;
      }

      log("⏳ No India match yet… retrying in 30s");
      await wait(30000);
    } catch (err) {
      console.error("❌ Error while searching match:", err);
      await wait(30000);
    }
  }

  pollingLoop();
}

async function pollingLoop() {
  try {
    log(`\n🔄 Polling: ${MATCH_NAME || MATCH_ID}`, true);

    const score = await getMatchScore(MATCH_ID);
    let comm = null;

    try {
      comm = await getCommentary(MATCH_ID);
    } catch (e) {
      log("⚠ Commentary API failed, continuing with scorecard only");
    }

    if (!score) {
      log("⚠ No score data… retrying");
      await wait(POLL_WAIT_TIME);
      return pollingLoop();
    }

    const mini = comm?.miniscore || {};
    const currInnings = getCorrectInnings(score, mini);

    if (!currInnings) {
      log("⚠ No innings found in scorecard");
      await wait(POLL_WAIT_TIME);
      return pollingLoop();
    }

    const prevInnings = globalThis.LAST_INNINGS;

    if (!prevInnings) {
      globalThis.LAST_INNINGS = JSON.parse(JSON.stringify(currInnings));
      globalThis.LAST_OVER = parseFloat(currInnings.overs) || 0;
      globalThis.LAST_BALL = currInnings.ballnbr ?? null;
      console.log("📌 Initial innings snapshot saved");
      await wait(POLL_WAIT_TIME);
      return pollingLoop();
    }

    const oversNow = parseFloat(currInnings.overs);
    const currBall = currInnings.ballnbr ?? null;

    if (
      currBall !== null &&
      globalThis.LAST_BALL !== null &&
      currBall < globalThis.LAST_BALL
    ) {
      log(
        `⏩ Stale ball (${currBall} < ${globalThis.LAST_BALL}) — skipping this tick`
      );
      await wait(POLL_WAIT_TIME);
      return pollingLoop();
    }

    if (
      currBall !== null &&
      globalThis.LAST_BALL !== null &&
      currBall === globalThis.LAST_BALL
    ) {
      log(`⏩ No new ball yet (ballnbr=${currBall})`);
      await wait(POLL_WAIT_TIME);
      return pollingLoop();
    }

    if (
      !Number.isNaN(oversNow) &&
      globalThis.LAST_OVER !== null &&
      oversNow < globalThis.LAST_OVER
    ) {
      log(
        `⏩ Stale over (${oversNow} < ${globalThis.LAST_OVER}) — skipping this tick`
      );
      await wait(POLL_WAIT_TIME);
      return pollingLoop();
    }

    const evWicket = detectWicket(prevInnings, currInnings);
    const evMilestone = detectMilestone(prevInnings, currInnings);
    const evSix = detectSix(prevInnings, currInnings);
    const evFour = detectFour(prevInnings, currInnings);
    const evPartnership = detectPartnership(prevInnings, currInnings);

    const event = evWicket || evMilestone || evSix || evFour || evPartnership;

    globalThis.LAST_INNINGS = JSON.parse(JSON.stringify(currInnings));
    globalThis.LAST_OVER = oversNow;
    globalThis.LAST_BALL = currBall;

    if (!event) {
      log("ℹ No significant event on this ball");
      await wait(POLL_WAIT_TIME);
      return pollingLoop();
    }

    log("🎯 EVENT DETECTED:", event.type, event);

    const matchContext = buildMatchContext({
      score,
      comm,
      currInnings,
      event,
    });
    console.log("matchContext:::", matchContext);

    const tweetContent = await generateTweet(matchContext);

    if (!tweetContent || tweetContent.trim().toUpperCase() === "SKIP") {
      log("ℹ AI decided to SKIP this event");
      await wait(POLL_WAIT_TIME);
      return pollingLoop();
    }

    const resp = USE_WEB_TWEET
      ? await postTweet_web(tweetContent)
      : await postTweet_console(tweetContent);

    if (resp?.id) log("🟢 Tweet posted!");
    else log("⚠ Tweet NOT posted (duplicate or API error)");
  } catch (err) {
    console.error("❌ ERROR in pollingLoop:", err);
  }

  await wait(POLL_WAIT_TIME);
  return pollingLoop();
}

startBot();
