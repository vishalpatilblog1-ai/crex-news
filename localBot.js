// localBot.js — Fully AI-based, no manual detectEvents
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import dotenv from "dotenv";
dotenv.config();

import { getMatchScore, getCommentary } from "./cricbuzz/cricbuzzApi.js";
import generateTweet from "./ai.js";
import { postTweet_console, postTweet_web } from "./Puppeteer/postTweet.js";

const FORCE_MATCH_ID = 117380;
const FORCE_MATCH_NAME = "South Africa vs India";

let CURRENT_MATCH_ID = FORCE_MATCH_ID;
let CURRENT_MATCH_NAME = FORCE_MATCH_NAME;

console.log("🔥 AI-Based Cricket Bot Started (Console Only)");
console.log(`📌 Match: ${CURRENT_MATCH_NAME}`);

const POLL_INTERVAL = 5000; // 5 seconds
let lastBall = null;

function extractLatestCommentary(res) {
  if (!res || !Array.isArray(res.comwrapper)) return null;

  const list = res.comwrapper.map((item) => item.commentary).filter(Boolean);

  if (!list.length) return null;

  // Iterate from newest → oldest
  for (const ball of list) {
    if (!ball) continue;

    const txt = (ball.commtxt || "").trim();

    // ❌ Skip ONLY pure ghost entries
    if (txt === "" || txt === "B0$") {
      continue;
    }

    // ✔ Accept everything else, even if overnum/ballnbr are 0
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
    nonStrikerBallsPlayed: miniscore.batsmannonstriker?.balls || "",
  };
}

function buildMatchContext(scoreRes, commRes, latestBall) {
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
  };

  const players = getMiniScorePlayers(miniscore);

  const matchContext = {
    match: {
      name: `${team1} vs ${team2}`,
      format,
      status,
      venue: "", // can be extended if needed
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
    },
    players,
  };

  return matchContext;
}
const USE_WEB_TWEET = false;
async function poll() {
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

    if (lastBall && lastBall === latest.ballnbr) {
      console.log("⏩ Same ball, skipping...");
      return;
    }
    lastBall = latest.ballnbr;

    const matchContext = buildMatchContext(scoreRes, commentaryRaw, latest);

    const tweetContent = await generateTweet(matchContext);
    console.log("content::", {
      text: latest.commtxt,
      eventtype: latest.eventtype,
      overnum: latest.overnum,
      inningsid: latest.inningsid,
      ballnbr: latest.ballnbr,
    });
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

    // const { postTweet } = await import("./Puppeteer/postTweet.js");
    // await postTweet(tweetContent);

    // console.log("🟢 Tweet posted!");

    // Console tweet

    // if (!tweetContent || tweetContent.trim().toUpperCase() === "SKIP") {
    //   console.log("ℹ AI decided to SKIP this ball");
    //   return;
    // }

    // console.log("\n📝 AI TWEET:");
    // console.log(tweetContent);
  } catch (err) {
    console.error("❌ ERROR in poll():", err);
  }
}

setInterval(poll, POLL_INTERVAL);
