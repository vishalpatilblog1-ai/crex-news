// localBot.js — FINAL AI-Based Local Bot (Puppeteer / Console)

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import dotenv from "dotenv";
dotenv.config();

import { getMatchScore, getCommentary } from "./cricbuzz/cricbuzzApi.js";
import generateTweet from "./ai.js";
import { postTweet_console, postTweet_web } from "./Puppeteer/postTweet.js";

const FORCE_MATCH_ID = 117380;
const FORCE_MATCH_NAME = "South Africa vs India";

const POLL_WAIT_TIME = 10000;

const USE_WEB_TWEET = false;

globalThis.LAST_BALL = null;
globalThis.LAST_HASH = null;
globalThis.LAST_EVENT_BALL = {};

let CURRENT_MATCH_ID = FORCE_MATCH_ID;
let CURRENT_MATCH_NAME = FORCE_MATCH_NAME;

console.log(`📌 Match: ${CURRENT_MATCH_NAME}`);

// Simple sleep
const wait = (ms) => new Promise((res) => setTimeout(res, ms));

function extractLatestCommentary(res) {
  if (!res || !Array.isArray(res.comwrapper)) return null;

  const list = res.comwrapper.map((item) => item.commentary).filter(Boolean);
  if (!list.length) return null;

  // Newest → oldest
  for (const ball of list) {
    if (!ball) continue;
    const txt = (ball.commtxt || "").trim();
    if (txt === "" || txt === "B0$") continue; // ghost entries
    return ball;
  }

  return null;
}

function getCurrentInningsFromScore(scoreRes, miniscore) {
  if (!scoreRes?.scorecard || !Array.isArray(scoreRes.scorecard)) return null;

  if (miniscore?.inningsid) {
    const byId = scoreRes.scorecard.find(
      (inn) => inn.inningsid === miniscore.inningsid
    );
    if (byId) return byId;
  }

  return scoreRes.scorecard[scoreRes.scorecard.length - 1] || null;
}

function normalizeOvers(overs) {
  if (overs == null) return overs;
  const parts = overs.toString().split(".");
  const full = parseInt(parts[0], 10);
  const balls = parseInt(parts[1] || "0", 10);
  if (balls === 6) return (full + 1).toFixed(1).replace(".0", "");
  return overs;
}

function getMiniScorePlayers(miniscore) {
  if (!miniscore) return {};
  return {
    striker: miniscore.batsmanstriker?.name || "",
    nonStriker: miniscore.batsmannonstriker?.name || "",
    bowler: miniscore.bowlerstriker?.name || "",
    strikerRuns: miniscore.batsmanstriker?.runs || "",
    strikerBallsPlayed: miniscore.batsmanstriker?.balls || "",
    nonStrikerRuns: miniscore.batsmannonstriker?.runs || "",
    nonStrikerBallsPlayed: miniscore.batsmannonstrister?.balls || "",
  };
}

function buildMatchContext(scoreRes, commRes, latestBall) {
  const partnership = commRes?.miniscore?.partnership;

  const miniscore = commRes?.miniscore || {};
  const matchheaders = commRes?.matchheaders || {};
  const currentInnings = getCurrentInningsFromScore(scoreRes, miniscore);

  const format = matchheaders.matchformat || "UNKNOWN";
  const status = matchheaders.status || scoreRes?.status || "";

  const team1 =
    matchheaders.team1?.teamname || scoreRes?.scorecard?.[0]?.batteamname || "";
  const team2 =
    matchheaders.team2?.teamname || scoreRes?.scorecard?.[1]?.batteamname || "";

  const inningsscores = miniscore.inningsscores?.inningsscore || [];
  const battingInnings =
    inningsscores.find((inn) => inn.inningsid === miniscore.inningsid) ||
    inningsscores[0] ||
    {};

  const inningsContext = {
    battingTeam:
      matchheaders.teamdetails?.batteamname ||
      battingInnings.batteamshortname ||
      currentInnings?.batteamname ||
      "",
    bowlingTeam: matchheaders.teamdetails?.bowlteamname || "",
    runs: battingInnings.runs ?? currentInnings?.score ?? null,
    wickets: battingInnings.wickets ?? currentInnings?.wickets ?? null,
    overs: normalizeOvers(
      battingInnings.overs ?? currentInnings?.overs ?? null
    ),
    target: miniscore.target ?? 0,
    crr: miniscore.crr ?? currentInnings?.runrate ?? null,
    rrr: miniscore.rrr ?? 0,
    trailOrLeadText: status || miniscore.custstatus || "",
    // currentPartnership: getCurrentPartnership(scoreRes, miniscore),
  };

  const players = getMiniScorePlayers(miniscore);

  return {
    match: {
      name: `${team1} vs ${team2}`,
      format,
      status,
      venue: "",
      team1,
      team2,
    },
    innings: inningsContext,
    ball: {
      text: latestBall.commtxt,
      eventtype: latestBall.eventtype,
      overnum: latestBall.overnum,
      inningsid: latestBall.inningsid,
      ballnbr: latestBall.ballnbr,
      partnership,
    },
    players,
  };
}

// ===============================
// MAIN POLL FUNCTION (ONE ITERATION)
// ===============================
async function pollOnce() {
  try {
    console.log(`\n🔄 Polling: ${CURRENT_MATCH_NAME}`);

    const scoreRes = await getMatchScore(CURRENT_MATCH_ID);
    if (!scoreRes || !scoreRes.scorecard) {
      return;
    }

    const commentaryRaw = await getCommentary(CURRENT_MATCH_ID);
    const latest = extractLatestCommentary(commentaryRaw);

    if (!latest) {
      return;
    }

    // Over-break events are boring → skip
    if (latest.eventtype === "over-break") {
      return;
    }

    const commHash = (latest.commtxt || "").trim();

    // DEDUPE 1: exact same ball + same text
    if (
      latest.ballnbr === globalThis.LAST_BALL &&
      commHash === globalThis.LAST_HASH
    ) {
      console.log("⏩ Exact same commentary — skipping...");
      return;
    }

    globalThis.LAST_BALL = latest.ballnbr;
    globalThis.LAST_HASH = commHash;

    // DEDUPE 2: per-event, per-ball (handles multiple commentary for same wicket/six/four)
    const EVENT_TYPES_TO_DEDUPE = [
      "WICKET",
      "SIX",
      "FOUR",
      "FIFTY",
      "HUNDRED",
      "TEAM_FIFTY",
      "TEAM_HUNDRED",
    ];

    if (EVENT_TYPES_TO_DEDUPE.includes(latest.eventtype)) {
      const prevBallForEvent = globalThis.LAST_EVENT_BALL[latest.eventtype];

      if (prevBallForEvent === latest.ballnbr) {
        console.log(
          `⏩ Duplicate ${latest.eventtype} on same ball (${latest.ballnbr}) — skipping`
        );
        return;
      }

      globalThis.LAST_EVENT_BALL[latest.eventtype] = latest.ballnbr;
    }

    const matchContext = buildMatchContext(scoreRes, commentaryRaw, latest);

    const tweetContent = await generateTweet(matchContext);

    console.log("tweetContent::", tweetContent);

    if (!tweetContent || tweetContent.trim().toUpperCase() === "SKIP") {
      console.log("ℹ AI decided to SKIP this ball");
      return;
    }

    if (USE_WEB_TWEET) {
      await postTweet_web(tweetContent);
    } else {
      await postTweet_console(tweetContent);
    }
  } catch (err) {
    console.error("❌ ERROR in pollOnce():", err);
  }
}

// ===============================
// LOOP
// ===============================
async function startLoop() {
  while (true) {
    await pollOnce();
    await wait(POLL_WAIT_TIME);
  }
}

startLoop();
