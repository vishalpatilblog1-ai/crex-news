// cricbuzz/index.js — FINAL MERGED VERSION (DUPLICATE SAFE)
import dotenv from "dotenv";
dotenv.config();

import generateTweet from "../ai.js";
import { postTweet_console, postTweet_web } from "../twitter.js";

import { createLogger } from "../utils/logger.js";
import { findIndiaMatch, getCommentary, getMatchScore } from "./cricbuzzApi.js";

globalThis.LAST_BALL = null;
globalThis.LAST_HASH = null;
globalThis.LAST_WICKET_BATSMAN = null;

const USE_WEB_TWEET = process.env.USE_WEB_TWEET === "true";

let MATCH_ID = null;
let MATCH_NAME = "";
const POLL_WAIT_TIME = 15000;

const log = createLogger("prod");

const wait = (ms) => new Promise((res) => setTimeout(res, ms));

function extractLatestCommentary(res) {
  if (!res?.comwrapper) return null;

  const all = res.comwrapper.map((x) => x.commentary).filter(Boolean);

  for (const ball of all) {
    const txt = (ball.commtxt || "").trim();
    if (txt === "" || txt === "B0$") continue;
    return ball;
  }

  return null;
}

function normalizeOvers(overs) {
  if (!overs) return overs;
  const p = overs.toString().split(".");
  const o = parseInt(p[0]);
  const b = parseInt(p[1] || "0");
  return b === 6 ? (o + 1).toFixed(1).replace(".0", "") : overs;
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

function getCurrentInnings(scoreRes, mini) {
  if (!scoreRes.scorecard) return null;
  if (mini.inningsid) {
    const found = scoreRes.scorecard.find(
      (i) => i.inningsid === mini.inningsid
    );
    if (found) return found;
  }
  return scoreRes.scorecard[scoreRes.scorecard.length - 1];
}

function getDismissedBatsman(text) {
  if (!text) return null;
  const parts = text.split(" to ");
  if (parts.length < 2) return null;
  return parts[1].split(",")[0].trim();
}

function buildMatchContext(scoreRes, commRes, ball) {
  const mini = commRes?.miniscore || {};
  const headers = commRes?.matchheaders || {};
  const innings = getCurrentInnings(scoreRes, mini);
  const partnership = commRes?.miniscore?.partnership;

  const active =
    mini.inningsscores?.inningsscore?.find(
      (i) => i.inningsid === mini.inningsid
    ) ||
    mini.inningsscores?.inningsscore?.[0] ||
    {};

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
      partnership,
    },

    players: getMiniPlayers(mini),
  };
}

/* ---------------------------------------
 * Start Bot
 * ---------------------------------------*/
async function startBot() {
  log("🔎 Searching for LIVE India match...");

  while (!MATCH_ID) {
    const match = await findIndiaMatch();

    if (match) {
      MATCH_ID = match.id;
      MATCH_NAME = match.name;
      log(`✅ Found LIVE match: ${MATCH_NAME}`);
      break;
    }

    log("⏳ No India match yet… retrying in 30s");
    await wait(30000);
  }

  pollingLoop();
}

/* ---------------------------------------
 * MAIN POLLING LOOP
 * ---------------------------------------*/
async function pollingLoop() {
  try {
    log(`\n🔄 Polling: ${MATCH_NAME}`);

    const score = await getMatchScore(MATCH_ID);
    const comm = await getCommentary(MATCH_ID);

    if (!score || !comm) {
      log("⚠ No data (API failed), retrying…");
      await wait(POLL_WAIT_TIME);
      return pollingLoop();
    }

    const latest = extractLatestCommentary(comm);
    if (!latest) {
      await wait(POLL_WAIT_TIME);
      return pollingLoop();
    }

    const commHash = latest.commtxt.trim();

    // ============================
    // DEDUPE 1: SAME COMMENTARY
    // ============================

    if (latest.ballnbr === globalThis.LAST_BALL) {
      log("⏩ Exact same commentary — skipping...");
      await wait(POLL_WAIT_TIME);
      return pollingLoop();
    }

    globalThis.LAST_BALL = latest.ballnbr;
    globalThis.LAST_HASH = commHash;

    if (latest.eventtype === "over-break") {
      log("⏭ Skipping over-break event…");
      await wait(POLL_WAIT_TIME);
      return pollingLoop();
    }

    if (latest.eventtype === "WICKET") {
      const outBatter = getDismissedBatsman(latest.commtxt);

      if (globalThis.LAST_WICKET_BATSMAN === outBatter) {
        log(
          `⏩ Duplicate wicket event for same batsman (${outBatter}) — skipping`
        );
        await wait(POLL_WAIT_TIME);
        return pollingLoop();
      }

      globalThis.LAST_WICKET_BATSMAN = outBatter;
    }

    const matchContext = buildMatchContext(score, comm, latest);

    log("matchContext::");
    log(matchContext);
    const tweetContent = await generateTweet(matchContext);

    log("tweetContent::");
    log(tweetContent);

    if (!tweetContent || tweetContent.trim().toUpperCase() === "SKIP") {
      log("ℹ AI skipped this ball");
      await wait(POLL_WAIT_TIME);
      return pollingLoop();
    }

    let resp;
    if (USE_WEB_TWEET) {
      resp = await postTweet_web(tweetContent);
    } else {
      resp = await postTweet_console(tweetContent);
    }

    if (resp?.id) {
      log("🟢 Tweet posted successfully!");
    } else {
      log("⚠ Tweet NOT posted (duplicate or API error)");
    }
  } catch (err) {
    console.error("❌ PollingLoop ERROR:", err);
  }

  await wait(POLL_WAIT_TIME);
  return pollingLoop();
}

startBot();
