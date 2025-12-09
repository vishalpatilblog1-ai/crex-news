//scorePollingLoop.js
import dotenv from "dotenv";
dotenv.config();
import { createLogger } from "../../utils/logger.js";

import {
  fetchNewsPhotoGallery,
  fetchNewsPhotos,
  getCommentary,
  getMatchScore,
} from "../cricbuzzApi.js";
import {
  extractTossInfo,
  getCorrectInnings,
  getCorrectTestInnings,
  getFirstInnings,
  handleMatchResultEvent,
  handleTossEvent,
} from "../match-events/tossAndResultHandler.js";
import {
  detectBatsmanMilestone,
  detectDefault,
  detectFour,
  detectMaidenOver,
  detectPartnership,
  detectSix,
  detectTeamMilestone,
  detectWicket,
} from "../inningsDetector.js";
import { fetchCommentaryTextByOverNumber } from "../fetchCommentaryTextByOverNumber.js";
import { buildMatchContext } from "../buildMatchContext.js";

import { postTweet_console, postTweet_web } from "../../twitter.js";
import generateTweet from "../ai/ai.js";
import { loadState } from "../../utils/stateStoreCloud.js";

const log = createLogger("prod");

const POLL_WAIT_TIME = 10000;
const USE_WEB_TWEET = process.env.USE_WEB_TWEET === "true";
const wait = (ms) => new Promise((res) => setTimeout(res, ms));
let STATE = loadState();

function formatTS() {
  const now = new Date();
  return now.toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
function isNewInnings(prevInn, currInn) {
  if (!prevInn || !currInn) return false;

  const prevOvers = parseFloat(prevInn.overs || 0);
  const currOvers = parseFloat(currInn.overs || 0);

  const currWkts = currInn.wickets ?? 0;

  // True new innings when overs drop AND wickets reset
  return prevOvers > currOvers && currWkts === 0;
}

export async function scorePollingLoop(MATCH_ID, MATCH_NAME) {
  //   const STATE = global.STATE;
  try {
    log(`\n🔄 Polling: ${MATCH_NAME || MATCH_ID}`, true);
    console.log(`🔄 Polling: ${MATCH_NAME || MATCH_ID} - [${formatTS()}]`);

    if (!globalThis.PREV_MATCH_ID || globalThis.PREV_MATCH_ID !== MATCH_ID) {
      console.log("🆕 New match detected — resetting global state");

      globalThis.LAST_INNINGS = null;
      globalThis.LAST_OVER = null;
      globalThis.LAST_BALL = null;
      globalThis.LAST_EVENT_BALL = {};
      globalThis.LAST_HASH = null; // IMPORTANT
      globalThis.LAST_PARTNERSHIP_MILESTONE = 0; // IMPORTANT
      globalThis.PREV_INNINGS_ID = null;
      globalThis.PREV_BATTEAM = null;
      globalThis.PREV_SNAPSHOT = null;

      globalThis.PREV_MATCH_ID = MATCH_ID;
    }

    const score = await getMatchScore(MATCH_ID);

    log("score::");
    log(score);

    // console.log("score:::", score);
    let comm = null;

    const firstInnings = getFirstInnings(score);
    const isMatchComplete = score?.ismatchcomplete;
    try {
      comm = await getCommentary(MATCH_ID);
      log("comm::");
      log(comm);
      // console.log("comm:::", comm);

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
      return scorePollingLoop(MATCH_ID, MATCH_NAME);
      //   return pollingLoop();
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

      return scorePollingLoop(MATCH_ID, MATCH_NAME);
    }

    const newInningsId = currInnings?.inningsid;
    const newTeam = currInnings?.batteamname;

    if (!globalThis.PREV_INNINGS_ID) {
      globalThis.PREV_INNINGS_ID = newInningsId;
      globalThis.PREV_BATTEAM = newTeam;
    }
    if (isNewInnings(globalThis.LAST_INNINGS, currInnings)) {
      console.log("🆕 TRUE NEW INNINGS DETECTED — resetting state");

      globalThis.LAST_INNINGS = JSON.parse(JSON.stringify(currInnings));
      globalThis.LAST_OVER = 0;
      globalThis.LAST_BALL = -1;
      globalThis.LAST_EVENT_BALL = {};

      globalThis.LAST_HASH = null;
      globalThis.LAST_PARTNERSHIP_MILESTONE = 0;

      await wait(POLL_WAIT_TIME);

      return scorePollingLoop(MATCH_ID, MATCH_NAME);
    }

    if (!globalThis.PREV_INNINGS_ID) {
      globalThis.PREV_INNINGS_ID = currInnings.inningsid;
    }

    if (!currInnings) {
      log("⚠ No innings found in scorecard");
      await wait(POLL_WAIT_TIME);
      return scorePollingLoop(MATCH_ID, MATCH_NAME);
    }

    const prevInnings = globalThis.LAST_INNINGS;

    if (!prevInnings) {
      globalThis.LAST_INNINGS = JSON.parse(JSON.stringify(currInnings));
      globalThis.LAST_OVER = parseFloat(currInnings.overs) || 0;
      globalThis.LAST_BALL = currInnings.ballnbr ?? null;
      console.log("📌 Initial innings snapshot saved");
      console.log(`💥 ${playingTeam1} Vs ${playingTeam2} 💥`);

      await wait(POLL_WAIT_TIME);
      return scorePollingLoop(MATCH_ID, MATCH_NAME);
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
      return scorePollingLoop(MATCH_ID, MATCH_NAME);
    }

    if (
      currBall !== null &&
      globalThis.LAST_BALL !== null &&
      currBall === globalThis.LAST_BALL
    ) {
      await wait(POLL_WAIT_TIME);
      //   return pollingLoop();
      return scorePollingLoop(MATCH_ID, MATCH_NAME);
    }

    if (
      !Number.isNaN(oversNow) &&
      globalThis.LAST_OVER !== null &&
      oversNow < globalThis.LAST_OVER
    ) {
      await wait(POLL_WAIT_TIME);
      //   return pollingLoop();
      return scorePollingLoop(MATCH_ID, MATCH_NAME);
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

    let evTeamMilestone = null;
    let evWicket = null;
    let evBatsmanMilestone = null;
    let evSix = null;
    let evFour = null;
    let evDefault = null;
    let evMaidenOver = null;

    if (isSingleBallAdvance) {
      evTeamMilestone = detectTeamMilestone(prevInnings, currInnings);
      evWicket = detectWicket(prevInnings, currInnings);
      evBatsmanMilestone = detectBatsmanMilestone(prevInnings, currInnings);
      evSix = detectSix(prevInnings, currInnings);
      evFour = detectFour(prevInnings, currInnings);
      evDefault = detectDefault(prevInnings, currInnings);
      evMaidenOver = detectMaidenOver(prevInnings, currInnings);

      if (evWicket) events.push(evWicket);
      if (evTeamMilestone) events.push(evTeamMilestone);
      if (evBatsmanMilestone) events.push(evBatsmanMilestone);
      if (evSix) events.push(evSix);
      if (evFour) events.push(evFour);
      // if (evMaidenOver) events.push(evMaidenOver);

      // if (evDefault) events.push(evDefault);
    }

    const evPartnership = detectPartnership(prevInnings, currInnings);

    if (evPartnership && evPartnership.type === "PARTNERSHIP_MILESTONE") {
      events.push(evPartnership);
    }
    globalThis.LAST_INNINGS = JSON.parse(JSON.stringify(currInnings));
    globalThis.LAST_OVER = oversNow;
    globalThis.LAST_BALL = currBall;

    if (events.length === 0) {
      await wait(POLL_WAIT_TIME);
      return scorePollingLoop(MATCH_ID, MATCH_NAME);
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

      const matchContext = buildMatchContext({
        comm,
        currInnings,
        event: singleEvent,
        isMatchComplete,
        firstInnings,
      });

      log("matchContext:::");
      log(matchContext);
      // console.log("matchContext::", JSON.stringify(matchContext, null, 2));

      const tweetContent = await generateTweet(matchContext, score);
      // log("tweetContent:::", tweetContent);

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

  return scorePollingLoop(MATCH_ID, MATCH_NAME);
}
