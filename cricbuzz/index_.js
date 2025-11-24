// cricbuzz/index.js — Pure AI + Twitter API Posting
import dotenv from "dotenv";
dotenv.config();

import generateTweet from "../ai.js";
import postTweet from "../twitter.js";
import { findIndiaMatch, getCommentary, getMatchScore } from "./cricbuzzApi.js";

let MATCH_ID = null;
let MATCH_NAME = "";
let lastBall = null;

const wait = (ms) => new Promise((res) => setTimeout(res, ms));

function extractLatestCommentary(res) {
  if (!res || !Array.isArray(res.comwrapper)) return null;

  const list = res.comwrapper.map((item) => item.commentary).filter(Boolean);

  for (const ball of list) {
    const txt = (ball?.commtxt || "").trim();
    if (txt === "" || txt === "B0$") continue;
    return ball;
  }

  return null;
}

function getCurrentInnings(scoreRes, mini) {
  if (!scoreRes?.scorecard) return null;

  const byId = mini?.inningsid
    ? scoreRes.scorecard.find((i) => i.inningsid === mini.inningsid)
    : null;

  return byId || scoreRes.scorecard[scoreRes.scorecard.length - 1];
}

function normalizeOvers(overs) {
  if (!overs) return overs;
  const parts = overs.toString().split(".");
  const full = parseInt(parts[0]);
  const balls = parseInt(parts[1] || "0");
  return balls === 6 ? (full + 1).toFixed(1).replace(".0", "") : overs;
}

function getMiniPlayers(mini) {
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

function buildMatchContext(scoreRes, commRes, ball) {
  const mini = commRes?.miniscore || {};
  const headers = commRes?.matchheaders || {};

  const innings = getCurrentInnings(scoreRes, mini);

  const innList = mini.inningsscores?.inningsscore || [];
  const active =
    innList.find((i) => i.inningsid === mini.inningsid) || innList[0] || {};

  const players = getMiniPlayers(mini);

  return {
    match: {
      name: `${headers.team1?.teamname} vs ${headers.team2?.teamname}`,
      format: headers.matchformat || "",
      status: headers.status || "",
      team1: headers.team1?.teamname || "",
      team2: headers.team2?.teamname || "",
      venue: "",
    },

    innings: {
      battingTeam:
        headers.teamdetails?.batteamname ||
        active.batteamshortname ||
        innings?.batteamname ||
        "",
      bowlingTeam: headers.teamdetails?.bowlteamname || "",
      runs: active.runs ?? innings?.score,
      wickets: active.wickets ?? innings?.wickets,
      overs: normalizeOvers(active.overs ?? innings?.overs),
      target: mini.target ?? 0,
      crr: mini.crr ?? innings?.runrate,
      rrr: mini.rrr ?? 0,
      trailOrLeadText: mini.custstatus || headers.status || "",
    },

    ball: {
      text: ball.commtxt,
      eventtype: ball.eventtype,
      overnum: ball.overnum,
      ballnbr: ball.ballnbr,
    },

    players,
  };
}

/* ------------------------------
 * AUTO FIND INDIA MATCH
 * ------------------------------*/
async function startBot() {
  console.log("🔎 Searching for LIVE India match...");

  while (!MATCH_ID) {
    const match = await findIndiaMatch();

    if (match) {
      MATCH_ID = match.id;
      MATCH_NAME = match.name;
      console.log(`✅ Found: ${MATCH_NAME}`);
      break;
    }

    await wait(30000);
  }

  pollingLoop();
}

/* ------------------------------
 * MAIN POLLING LOOP
 * ------------------------------*/
async function pollingLoop() {
  try {
    console.log(`\n🔄 Polling: ${MATCH_NAME}`);

    const score = await getMatchScore(MATCH_ID);
    const comm = await getCommentary(MATCH_ID);

    const latest = extractLatestCommentary(comm);
    if (!latest) {
      await wait(5000);
      return pollingLoop();
    }

    if (latest.ballnbr === lastBall) {
      console.log("⏩ Duplicate ball…");
      await wait(5000);
      return pollingLoop();
    }
    lastBall = latest.ballnbr;

    const ctx = buildMatchContext(score, comm, latest);
    console.log("content::", {
      text: latest.commtxt,
      eventtype: latest.eventtype,
      overnum: latest.overnum,
      ballnbr: latest.ballnbr,
    });

    const tweet = await generateTweet(ctx);

    console.log("✍️ Tweet:", tweet);

    if (!tweet || tweet.trim().toUpperCase() === "SKIP") {
      console.log("ℹ AI skipped this ball");
      await wait(5000);
      return pollingLoop();
    }

    // await postTweet(tweet);
    console.log("🟢 Tweet posted via Twitter API!");
  } catch (err) {
    console.error("❌ Loop Error:", err);
  }

  await wait(5000);
  pollingLoop();
}

startBot();
