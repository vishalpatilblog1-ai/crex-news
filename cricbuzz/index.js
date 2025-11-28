// cricbuzz/index.js — FINAL, STABLE, INNINGS-BASED, DUPLICATE-SAFE VERSION
import dotenv from "dotenv";
dotenv.config();

import generateTweet from "../ai.js";
import { postTweet_console, postTweet_web } from "../twitter.js";

import { shortTeamName } from "../utils/formatter.js";
import { createLogger } from "../utils/logger.js";
import { loadState, saveState } from "../utils/stateStore.js";
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
import { buildTemplateTweet } from "./templateEngine.js";

globalThis.LAST_INNINGS = null;
globalThis.LAST_OVER = null;
globalThis.LAST_BALL = null;
globalThis.LAST_PARTNERSHIP_MILESTONE = 0;
globalThis.LAST_EVENT_BALL = {};

const USE_WEB_TWEET = process.env.USE_WEB_TWEET === "true";

const FORCE_MATCH_ID = 126884;
// const FORCE_MATCH_ID = process.env.FORCE_MATCH_ID
//   ? Number(process.env.FORCE_MATCH_ID)
//   : null;

let MATCH_ID = FORCE_MATCH_ID || 0;
let MATCH_NAME = FORCE_MATCH_ID ? `Forced Match #${FORCE_MATCH_ID}` : "";

const POLL_WAIT_TIME = 5000;
const log = createLogger("prod");

const wait = (ms) => new Promise((res) => setTimeout(res, ms));

function extractTossInfo(comm) {
  const t = comm?.matchheaders?.tossresults;
  if (!t) return null;

  return {
    tossWinner: t.tosswinnername || "",
    tossDecision: (t.decision || "").toLowerCase(), // batting / bowling
    tossText: `${
      t.tosswinnername
    } won the toss and chose to ${t.decision.toLowerCase()}`,
  };
}

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
function getFirstInnings(scoreRes, mini) {
  const firstInning = scoreRes?.scorecard[0];
  return {
    targetRuns: firstInning.score,
    targetWicket: firstInning.wickets,
    targetOvers: firstInning.overs,
    battingTeamName: firstInning.batteamname,
    battingTeamShortName: firstInning.batteamsname,
  };
}

function normalizeOvers(overs) {
  if (!overs) return overs;
  const p = overs.toString().split(".");
  const o = parseInt(p[0]);
  const b = parseInt(p[1] || "0");
  return b === 6 ? (o + 1).toFixed(1).replace(".0", "") : overs;
}

function buildMatchContext({
  comm,
  currInnings,
  event,
  isMatchComplete,
  firstInnings,
}) {
  const mini = comm?.miniscore || {};
  const headers = comm?.matchheaders || {};

  if (event?.type === "MATCH_RESULT") {
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
      status: event?.resultText || headers?.status || "",
      venue: headers?.venue || "",
      isMatchComplete: true,
    };

    return {
      match,
      innings: null,
      event,
      players: {},
    };
  }

  if (event?.type === "TOSS") {
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
      isMatchComplete: false,
    };

    const displayMatchObject = {
      event, // has tossWinner, tossDecision, tossText
      team1: match.team1,
      team2: match.team2,
      team1Short: match.team1Short,
      team2Short: match.team2Short,
      format: match.format,
      status: match.status,
      players: {},
    };

    return {
      match,
      innings: null,
      event,
      players: {},
      displayMatchObject,
    };
  }
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
    targetInning: firstInnings,
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

    // console.log(JSON.stringify(score, null, 2));

    const isMatchComplete = score?.ismatchcomplete;
    let comm = null;
    try {
      comm = await getCommentary(MATCH_ID);
      // --------------------------------------
      // 🔥 TOSS Detection
      // --------------------------------------
      try {
        const toss = extractTossInfo(comm);

        if (toss && !STATE[`toss_${MATCH_ID}`]) {
          STATE[`toss_${MATCH_ID}`] = true;
          saveState(STATE);

          const syntheticEvent = {
            type: "TOSS",
            ...toss,
          };

          const matchContext = buildMatchContext({
            comm,
            currInnings: null,
            event: syntheticEvent,
            isMatchComplete: false,
            firstInnings: null,
          });

          const tweet = buildTemplateTweet(matchContext);

          if (tweet) {
            await postTweet_console(tweet);
            if (USE_WEB_TWEET) await postTweet_web(tweet);
          }

          log(`🪙 Toss tweet sent! -> ${toss.tossText}`);
        }
      } catch (e) {
        log("⚠ Toss detection error", e);
      }
    } catch (e) {
      log("⚠ Commentary API failed, continuing with scorecard only");
    }

    const playingTeam1 = comm?.matchheaders?.team1.teamname || "";
    const playingTeam2 = comm?.matchheaders?.team2.teamname || "";

    // console.log("score::", score);
    // console.log(JSON.stringify(score, null, 2));

    if (score?.ismatchcomplete && score?.status) {
      if (!STATE[`result_${MATCH_ID}`]) {
        STATE[`result_${MATCH_ID}`] = true;
        saveState(STATE);

        const syntheticEvent = {
          type: "MATCH_RESULT",
          resultText: score.status,
        };

        const matchContext = buildMatchContext({
          comm,
          currInnings: null,
          event: syntheticEvent,
          isMatchComplete: true,
          firstInnings,
        });

        const tweet = buildTemplateTweet(matchContext); // 👈 use YOUR template builder
        if (tweet) {
          await postTweet_console(tweet);
          if (USE_WEB_TWEET) await postTweet_web(tweet);
        }

        console.log("🏆 Match result tweet sent!");
      }

      return;
    }

    if (!score) {
      log("⚠ No score data… retrying");
      await wait(POLL_WAIT_TIME);
      return pollingLoop();
    }

    const mini = comm?.miniscore || {};
    const currInnings = getCorrectInnings(score, mini);
    const firstInnings = getFirstInnings(score, mini);

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
    if (prevInnings.inningsid !== currInnings.inningsid) {
      log("🔁 New innings detected — resetting all trackers");

      globalThis.LAST_INNINGS = JSON.parse(JSON.stringify(currInnings));
      globalThis.LAST_OVER = parseFloat(currInnings.overs) || 0;
      globalThis.LAST_BALL = currInnings.ballnbr ?? 0;

      globalThis.LAST_EVENT_BALL = {}; // reset event dedupe map
      globalThis.LAST_PARTNERSHIP_MILESTONE = 0; // reset milestone tracking

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
      // evBowlerMilestone = detectBowlerMilestone(prevInnings, currInnings);
      evWicket = detectWicket(prevInnings, currInnings);
      evBatsmanMilestone = detectBatsmanMilestone(prevInnings, currInnings);
      evSix = detectSix(prevInnings, currInnings);
      evFour = detectFour(prevInnings, currInnings);

      if (evWicket) events.push(evWicket);
      if (evBatsmanMilestone) events.push(evBatsmanMilestone);
      if (evSix) events.push(evSix);
      if (evFour) events.push(evFour);
      // if (evBowlerMilestone) events.push(evBowlerMilestone);
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
      const eventType = singleEvent.type;
      const ballNbr = singleEvent.ballnbr || currInnings.ballnbr;

      if (eventType && ballNbr) {
        if (globalThis.LAST_EVENT_BALL[eventType] === ballNbr) {
          log(`⏩ Duplicate ${eventType} on ball ${ballNbr} — skipping`);
          continue;
        }
        globalThis.LAST_EVENT_BALL[eventType] = ballNbr;
      }
      const matchContext = buildMatchContext({
        comm,
        currInnings,
        event: singleEvent,
        isMatchComplete,
        firstInnings,
      });

      log("matchContext:::");
      log(matchContext);

      // console.log("matchContext:::", JSON.stringify(matchContext, null, 2));

      console.log("Evenet type::", matchContext.event);

      const tweetContent = await generateTweet(matchContext);
      console.log("tweetContent:::", tweetContent);

      if (!tweetContent || tweetContent.trim().toUpperCase() === "SKIP") {
        log(`ℹ AI skipped event: ${singleEvent.type}`);
        continue;
      }
      let resp = null;
      resp = await postTweet_web(tweetContent);

      // await postTweet_console(tweetContent);
      // let resp = null;
      // if (USE_WEB_TWEET) {
      //   resp = await postTweet_web(tweetContent);
      // }

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
