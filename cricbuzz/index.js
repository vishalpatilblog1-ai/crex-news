// cricbuzz/index.js — FINAL, STABLE, INNINGS-BASED, DUPLICATE-SAFE VERSION
import dotenv from "dotenv";
dotenv.config();

import generateTweet from "../ai.js";
import { postTweet_console, postTweet_web } from "../twitter.js";

import { createLogger } from "../utils/logger.js";
import { loadState } from "../utils/stateStore.js";
import { buildMatchContext } from "./buildMatchContext.js";
import { findIndiaMatch, getCommentary, getMatchScore } from "./cricbuzzApi.js";
import { fetchCommentaryTextByOverNumber } from "./fetchCommentaryTextByOverNumber.js";
import {
  detectBatsmanMilestone,
  detectFour,
  detectPartnership,
  detectSix,
  detectWicket,
} from "./inningsDetector.js";
import {
  extractTossInfo,
  getCorrectInnings,
  getCorrectTestInnings,
  getFirstInnings,
  handleMatchResultEvent,
  handleTossEvent,
} from "./match-events/tossAndResultHandler.js";

globalThis.LAST_INNINGS = null;
globalThis.LAST_OVER = null;
globalThis.LAST_BALL = null;
globalThis.LAST_PARTNERSHIP_MILESTONE = 0;
globalThis.LAST_EVENT_BALL = {};

const USE_WEB_TWEET = process.env.USE_WEB_TWEET === "true";

const FORCE_MATCH_ID = process.env.FORCE_MATCH_ID
  ? Number(process.env.FORCE_MATCH_ID)
  : null;

// const FORCE_MATCH_ID = 138699;

let MATCH_ID = FORCE_MATCH_ID || 0;
let MATCH_NAME = FORCE_MATCH_ID ? `Forced Match #${FORCE_MATCH_ID}` : "";

const POLL_WAIT_TIME = 5000;
const log = createLogger("prod");

const wait = (ms) => new Promise((res) => setTimeout(res, ms));

let STATE = loadState();
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
    console.log(`\n🔄 Polling: ${MATCH_NAME || MATCH_ID}`);

    const score = await getMatchScore(MATCH_ID);

    let comm = null;
    const mini = comm?.miniscore || {};
    const firstInnings = getFirstInnings(score);
    const isMatchComplete = score?.ismatchcomplete;
    try {
      comm = await getCommentary(MATCH_ID);

      console.log("current running score over::", globalThis.LAST_OVER);
      const toss = extractTossInfo(comm);
      await handleTossEvent({
        comm,
        score,
        toss,
        MATCH_ID,
        STATE,
        USE_WEB_TWEET,
      });
    } catch (e) {
      log("⚠ Commentary API failed, continuing with scorecard only");
    }

    const playingTeam1 = comm?.matchheaders?.team1.teamname || "";
    const playingTeam2 = comm?.matchheaders?.team2.teamname || "";

    await handleMatchResultEvent({
      comm,
      score,
      STATE,
      MATCH_ID,
      USE_WEB_TWEET,
      firstInnings,
    });

    if (!score) {
      log("⚠ No score data… retrying");
      await wait(POLL_WAIT_TIME);
      return pollingLoop();
    }

    let currInnings;

    if (comm?.matchheaders?.matchformat === "TEST") {
      const liveId = comm?.miniscore?.inningsid;
      currInnings = getCorrectTestInnings(score, liveId);
    } else {
      currInnings = getCorrectInnings(score);
    }

    if (!currInnings) {
      log("⚠ No innings yet (Test match probably not started) — waiting...");
      await wait(POLL_WAIT_TIME);
      return pollingLoop();
    }

    const newInningsId = currInnings?.inningsid;
    const newTeam = currInnings?.batteamname;

    if (!globalThis.PREV_INNINGS_ID) {
      globalThis.PREV_INNINGS_ID = newInningsId;
      globalThis.PREV_BATTEAM = newTeam;
    }

    const changed =
      globalThis.PREV_INNINGS_ID !== newInningsId ||
      globalThis.PREV_BATTEAM !== newTeam;

    if (changed) {
      console.log("🆕 New innings detected — resetting state");

      globalThis.LAST_HASH = null;
      globalThis.LAST_BALL = null;
      globalThis.LAST_EVENT_BALL = {};
      globalThis.PREV_SNAPSHOT = null;

      globalThis.PREV_INNINGS_ID = newInningsId;
      globalThis.PREV_BATTEAM = newTeam;

      return;
    }

    if (!globalThis.PREV_INNINGS_ID) {
      globalThis.PREV_INNINGS_ID = currInnings.inningsid;
    }

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
      console.log(`💥 ${playingTeam1} Vs ${playingTeam2} 💥`);

      await wait(POLL_WAIT_TIME);
      return pollingLoop();
    }

    const oversNow = parseFloat(currInnings.overs);
    const currBall = currInnings.ballnbr ?? null;

    const prevOver = Math.floor(globalThis.LAST_BALL / 6);
    const currOver = Math.floor(currBall / 6);

    log("current running over::");
    log(globalThis.LAST_OVER);
    console.log("current running over::", globalThis.LAST_OVER);

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

      if (evWicket) events.push(evWicket);
      if (evBatsmanMilestone) events.push(evBatsmanMilestone);
      if (evSix) events.push(evSix);
      if (evFour) events.push(evFour);
    }

    const evPartnership = detectPartnership(prevInnings, currInnings);

    if (evPartnership && evPartnership.type !== "PARTNERSHIP_UPDATED") {
      events.push(evPartnership);
    }

    globalThis.LAST_INNINGS = JSON.parse(JSON.stringify(currInnings));
    globalThis.LAST_OVER = oversNow;
    globalThis.LAST_BALL = currBall;

    if (events.length === 0) {
      await wait(POLL_WAIT_TIME);
      return pollingLoop();
    }

    for (const singleEvent of events) {
      const eventType = singleEvent.type;
      const ballNbr = currInnings.ballnbr;

      if (eventType && ballNbr) {
        if (globalThis.LAST_EVENT_BALL[eventType] === ballNbr) {
          log(`⏩ Duplicate ${eventType} on ball ${ballNbr} — skipping`);
          continue;
        }
        globalThis.LAST_EVENT_BALL[eventType] = ballNbr;
      }

      const commentaryTexts = fetchCommentaryTextByOverNumber(
        comm,
        singleEvent.currentOver
      );

      console.log("🎤 Commentary lines for event:", commentaryTexts);

      singleEvent.commentaryTexts = commentaryTexts;
      console.log("singleEvent::", singleEvent);
      const matchContext = buildMatchContext({
        comm,
        currInnings,
        event: singleEvent,
        isMatchComplete,
        firstInnings,
      });

      log("matchContext:::");
      log(matchContext);
      const tweetContent = await generateTweet(matchContext);
      console.log("tweetContent:::", tweetContent);

      if (!tweetContent || tweetContent.trim().toUpperCase() === "SKIP") {
        log(`ℹ AI skipped event: ${singleEvent.type}`);
        continue;
      }
      let resp = null;

      if (USE_WEB_TWEET) {
        resp = await postTweet_web(tweetContent);
        console.log("🌐 WEB Tweet Response:", resp);
      } else {
        await postTweet_console(tweetContent);
        console.log("💻 Console mode active");
      }

      if (resp?.id) log(`🟢 WEB Tweet posted for event: ${singleEvent.type}!`);

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
