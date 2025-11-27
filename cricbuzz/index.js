// cricbuzz/index.js — FINAL, STABLE, INNINGS-BASED, DUPLICATE-SAFE VERSION
import dotenv from "dotenv";
dotenv.config();

import generateTweet from "../ai.js";
import { postTweet_console, postTweet_web } from "../twitter.js";

import { EVENT_TYPES, PARTNERSHIP_MILESTONE_RUNS } from "../utils/constants.js";
import { shortTeamName } from "../utils/formatter.js";
import { createLogger } from "../utils/logger.js";
import { findIndiaMatch, getCommentary, getMatchScore } from "./cricbuzzApi.js";
import {
  detectBatsmanMilestone,
  detectBowlerMilestone,
  detectFour,
  detectPartnership,
  detectSix,
  detectWicket,
  getActiveBattersFromInnings,
  getPartnershipContributions,
} from "./inningsDetector.js";
import { matchContextdata } from "../matchContextData.js";

globalThis.LAST_INNINGS = null;
globalThis.LAST_OVER = null;
globalThis.LAST_BALL = null;
globalThis.LAST_PARTNERSHIP_MILESTONE = 0;

const USE_WEB_TWEET = process.env.USE_WEB_TWEET === "true";

const FORCE_MATCH_ID = 134452;

let MATCH_ID = FORCE_MATCH_ID || 0;
let MATCH_NAME = FORCE_MATCH_ID ? `Forced Match #${FORCE_MATCH_ID}` : "";

const POLL_WAIT_TIME = 5000;
const log = createLogger("prod");

const wait = (ms) => new Promise((res) => setTimeout(res, ms));

function getCorrectInnings(scoreRes, mini) {
  const card = scoreRes?.scorecard;
  if (!card || card.length === 0) return null;

  if (mini?.inningsid) {
    const byMini = card.find((i) => i.inningsid === mini.inningsid);
    if (byMini) return byMini;
  }

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

function buildMatchContext({ comm, currInnings, event, isMatchComplete }) {
  const mini = comm?.miniscore || {};
  const headers = comm?.matchheaders || {};

  const active = getActiveBattersFromInnings(currInnings);
  const partnership = getPartnershipContributions(currInnings);

  const players = {
    striker: active.bat1,
    nonStriker: active.bat2,
    strikerRuns: "",
    strikerBallsPlayed: "",
    nonStrikerRuns: "",
    nonStrikerBallsPlayed: "",
    bowler: mini?.bowlerstriker?.name || "",
  };

  if (event?.type === "WICKET" && event?.batterName) {
    players.striker = event.batterName;
  }

  const match = {
    name:
      headers?.matchdescription ||
      `${headers?.team1?.teamname || ""} vs ${
        headers?.team2?.teamname || ""
      }`.trim(),
    team1: headers?.team1?.teamname || "",
    team2: headers?.team2?.teamname || "",
    team1Short:
      headers?.team1?.teamsname ||
      shortTeamName(headers?.team1?.teamname || ""),
    team2Short:
      headers?.team2?.teamsname ||
      shortTeamName(headers?.team2?.teamname || ""),

    format: headers?.matchformat || "",
    status: headers?.status || "",
    venue: headers?.venue || "",
    isMatchComplete,
  };

  const innings = {
    inningsid: currInnings.inningsid,
    runs: currInnings.score,
    wickets: currInnings.wickets,
    overs: normalizeOvers(currInnings.overs),
    batteamname: currInnings.batteamname,
    batteamsname: currInnings.batteamsname,
    partnership: currInnings.partnership,
    batsman: currInnings.batsman,
    bowler: currInnings.bowler,
    partnership,
  };

  const displayMatchObject = {
    event,
    team1: headers?.team1?.teamname || "",
    team2: headers?.team2?.teamname || "",
    team1Short:
      headers?.team1?.teamsname ||
      shortTeamName(headers?.team1?.teamname || ""),
    team2Short:
      headers?.team2?.teamsname ||
      shortTeamName(headers?.team2?.teamname || ""),

    format: headers?.matchformat || "",
    status: headers?.status || "",
    players,
  };

  return {
    match,
    innings,
    event,
    players,
    displayMatchObject,
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

    const isMatchComplete = score?.ismatchcomplete;
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

    const prevOver = Math.floor(globalThis.LAST_BALL / 6);
    const currOver = Math.floor(currBall / 6);

    log("current running over::");
    log(globalThis.LAST_OVER);

    // ==== OLD BALL CHECKS (KEPT EXACTLY SAME) ====

    if (currBall < globalThis.LAST_BALL && currOver === prevOver) {
      await wait(POLL_WAIT_TIME);
      return pollingLoop();
    }

    if (
      currBall !== null &&
      globalThis.LAST_BALL !== null &&
      currBall === globalThis.LAST_BALL
    ) {
      await wait(POLL_WAIT_TIME);
      return pollingLoop();
    }

    if (
      !Number.isNaN(oversNow) &&
      globalThis.LAST_OVER !== null &&
      oversNow < globalThis.LAST_OVER
    ) {
      await wait(POLL_WAIT_TIME);
      return pollingLoop();
    }

    let isSingleBallAdvance = true;

    if (
      prevInnings.ballnbr !== null &&
      currBall !== null &&
      Math.abs(currBall - prevInnings.ballnbr) > 1
    ) {
      isSingleBallAdvance = false;
    }

    let events = [];

    let evWicket = null;
    let evBatsmanMilestone = null;
    let evSix = null;
    let evFour = null;
    let evBowlerMilestone = null;

    if (isSingleBallAdvance) {
      evWicket = detectWicket(prevInnings, currInnings);
      evBatsmanMilestone = detectBatsmanMilestone(prevInnings, currInnings);
      evSix = detectSix(prevInnings, currInnings);
      evFour = detectFour(prevInnings, currInnings);
      evBowlerMilestone = detectBowlerMilestone(prevInnings, currInnings);

      if (evWicket) events.push(evWicket);
      if (evBatsmanMilestone) events.push(evBatsmanMilestone);
      if (evSix) events.push(evSix);
      if (evFour) events.push(evFour);
      if (evBowlerMilestone) events.push(evBowlerMilestone);
    }

    const evPartnership = detectPartnership(prevInnings, currInnings);
    if (evPartnership) events.push(evPartnership);

    globalThis.LAST_INNINGS = JSON.parse(JSON.stringify(currInnings));
    globalThis.LAST_OVER = oversNow;
    globalThis.LAST_BALL = currBall;

    if (events.length === 0) {
      await wait(POLL_WAIT_TIME);
      return pollingLoop();
    }

    for (const singleEvent of events) {
      const matchContext = buildMatchContext({
        comm,
        currInnings,
        event: singleEvent,
        isMatchComplete,
      });

      const tweetContent = await generateTweet(matchContext);

      if (!tweetContent || tweetContent.trim().toUpperCase() === "SKIP") {
        log(`ℹ AI skipped event: ${singleEvent.type}`);
        continue;
      }

      const resp = USE_WEB_TWEET
        ? await postTweet_web(tweetContent)
        : await postTweet_console(tweetContent);

      if (resp?.id) log(`🟢 Tweet posted for event: ${singleEvent.type}!`);
      else log(`⚠ Tweet NOT posted for event: ${singleEvent.type}`);
    }
  } catch (err) {
    console.error("❌ ERROR in pollingLoop:", err);
  }

  await wait(POLL_WAIT_TIME);
  return pollingLoop();
}

startBot();
