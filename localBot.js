// localBot.js — FINAL SCORECARD-BASED LOCAL BOT (MATCHING index.js)

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import dotenv from "dotenv";
dotenv.config();

import { getMatchScore, getCommentary } from "./cricbuzz/cricbuzzApi.js";
import { fetchCommentaryTextByOverNumber } from "./cricbuzz/fetchCommentaryTextByOverNumber.js";

import generateTweet from "./ai.js";
import { postTweet_console, postTweet_web } from "./Puppeteer/postTweet.js";

import { createLogger } from "./utils/logger.js";

import {
  detectBatsmanMilestone,
  detectFour,
  detectPartnership,
  detectSix,
  detectTeamMilestone,
  detectWicket,
} from "./cricbuzz/inningsDetector.js";

import { buildMatchContext } from "./cricbuzz/buildMatchContext.js";

const log = createLogger("local");

// ========= CONFIG =========
const FORCE_MATCH_ID = 117389;
const FORCE_MATCH_NAME = "FOREIGN LOCAL BOT TEST";

const USE_WEB_TWEET = false;
const POLL_WAIT_TIME = 5000;

// ========= GLOBALS =========
globalThis.LAST_INNINGS = null;
globalThis.LAST_OVER = null;
globalThis.LAST_BALL = null;
globalThis.LAST_EVENT_BALL = {}; // per-event dedupe

function wait(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

function isNewInnings(prevInn, currInn) {
  if (!prevInn || !currInn) return false;

  const prevOvers = parseFloat(prevInn.overs || 0);
  const currOvers = parseFloat(currInn.overs || 0);

  const prevWkts = prevInn.wickets ?? 0;
  const currWkts = currInn.wickets ?? 0;

  // Overs reset + wickets reset → new innings
  return prevOvers > currOvers && currWkts === 0;
}

async function pollOnce() {
  try {
    log(`🔄 Polling LOCAL MATCH: ${FORCE_MATCH_NAME}`);

    // ============= 1. SCORECARD =============
    const scoreRes = await getMatchScore(FORCE_MATCH_ID);
    if (!scoreRes || !scoreRes.scorecard) {
      log("⚠ No scorecard… retrying");
      return;
    }

    const commRes = await getCommentary(FORCE_MATCH_ID);

    // Determine current innings
    const currInnings =
      scoreRes.scorecard[scoreRes.scorecard.length - 1] || null;

    if (!currInnings) {
      log("⚠ No current innings yet");
      return;
    }

    // ======= NEW INNINGS DETECTED ========
    if (isNewInnings(globalThis.LAST_INNINGS, currInnings)) {
      console.log("🆕 TRUE NEW INNINGS DETECTED — resetting state");
      globalThis.LAST_INNINGS = JSON.parse(JSON.stringify(currInnings));
      globalThis.LAST_OVER = 0;
      globalThis.LAST_BALL = -1;
      globalThis.LAST_EVENT_BALL = {};
      return;
    }

    // ======= FIRST RUN / INITIAL SET =======
    if (!globalThis.LAST_INNINGS) {
      globalThis.LAST_INNINGS = JSON.parse(JSON.stringify(currInnings));
      globalThis.LAST_OVER = parseFloat(currInnings.overs) || 0;
      globalThis.LAST_BALL = currInnings.ballnbr ?? null;

      console.log("📌 Initial innings snapshot saved");
      console.log(
        `💥 ${scoreRes.scorecard[0]?.batteamname} Vs ${scoreRes.scorecard[1]?.batteamname} 💥`
      );
      return;
    }

    // ============= 2. NEW BALL CHECK =============
    const prevInn = globalThis.LAST_INNINGS;
    const currBall = currInnings.ballnbr ?? null;

    const prevBall = globalThis.LAST_BALL;

    if (currBall !== null && prevBall !== null && currBall === prevBall) {
      return; // same ball → skip
    }

    const oversNow = parseFloat(currInnings.overs);

    if (oversNow < globalThis.LAST_OVER) {
      return; // overs reversed but NOT new innings → skip
    }

    // ============= 3. EVENT DETECTION =============
    let events = [];

    const evTeam = detectTeamMilestone(prevInn, currInnings);
    const evWicket = detectWicket(prevInn, currInnings);
    const evBatMS = detectBatsmanMilestone(prevInn, currInnings);
    const evSix = detectSix(prevInn, currInnings);
    const evFour = detectFour(prevInn, currInnings);
    const evPart = detectPartnership(prevInn, currInnings);

    if (evWicket) events.push(evWicket);
    if (evTeam) events.push(evTeam);
    if (evBatMS) events.push(evBatMS);
    if (evSix) events.push(evSix);
    if (evFour) events.push(evFour);
    if (evPart && evPart.type === "PARTNERSHIP_MILESTONE") events.push(evPart);

    // ============= UPDATE SNAPSHOT =============
    globalThis.LAST_INNINGS = JSON.parse(JSON.stringify(currInnings));
    globalThis.LAST_OVER = oversNow;
    globalThis.LAST_BALL = currBall;

    if (events.length === 0) return;

    // ============= 4. PROCESS EVENTS =============
    for (const singleEvent of events) {
      const eventType = singleEvent.type;
      const ballNbr = currInnings.ballnbr;

      // DEDUPE by event type per ball
      if (globalThis.LAST_EVENT_BALL[eventType] === ballNbr) {
        log(`⏩ Duplicate ${eventType} on ball ${ballNbr} — skipped`);
        continue;
      }
      globalThis.LAST_EVENT_BALL[eventType] = ballNbr;

      // ============= FETCH COMMENTARY TEXTS =============
      const lines = fetchCommentaryTextByOverNumber(
        commRes,
        singleEvent.currentOver
      );

      singleEvent.commentaryTexts = lines;

      // ============= BUILD MATCH CONTEXT =============
      const matchContext = buildMatchContext({
        comm: commRes,
        currInnings,
        event: singleEvent,
        isMatchComplete: scoreRes.ismatchcomplete,
      });

      // ============= GENERATE TWEET =============
      const tweetContent = await generateTweet(matchContext);

      if (!tweetContent || tweetContent.trim().toUpperCase() === "SKIP") {
        log(`ℹ AI skipped event: ${singleEvent.type}`);
        continue;
      }

      if (USE_WEB_TWEET) {
        await postTweet_web(tweetContent);
      } else {
        await postTweet_console(tweetContent);
      }

      log(`🟢 Tweet posted for event: ${singleEvent.type}`);
    }
  } catch (err) {
    console.error("❌ ERROR in LOCAL pollOnce():", err);
  }
}

async function startLoop() {
  while (true) {
    await pollOnce();
    await wait(POLL_WAIT_TIME);
  }
}

startLoop();
