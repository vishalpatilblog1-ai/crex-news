// index.js (Railway-safe version)
// --------------------------------
// NO PUPPETEER HERE ✔
// USES TWITTER API ✔
// USES CRICBUZZ API DIRECT FETCH ✔

import dotenv from "dotenv";
import postTweet from "./twitter.js";
import { findBestLiveMatch } from "./findBestLiveMatch.js";
import generateTweet from "./ai.js";
import { buildFinalTweet } from "./utils/matchFormatting.js";
import { fetchScorecard } from "./cricbuzz/fetchScorecard.js";
import { fetchCommentary } from "./cricbuzz/fetchCommentary.js";

dotenv.config();

let CURRENT_MATCH_ID = null;
let CURRENT_MATCH_NAME = "";
let LAST_BALL_ID = null;
let LAST_SESSION = "";
let LAST_WINNER = "";
let LAST_TOSS_DONE = false;

const POLL_INTERVAL = 15000; // 15 sec score check
const SWITCH_INTERVAL = 60000; // 60 sec match switching check

// 🔥 Start Bot
async function startBot() {
  console.log("🚀 Starting Railway Bot (API mode)…");

  await pickMatch(true); // pick match first time

  pollLoop(); // score polling
  switchLoop(); // match switching
}

// 🔍 Pick best match using priority
async function pickMatch(firstTime = false) {
  const match = await findBestLiveMatch();

  if (!match) {
    console.log("❌ No live match found.");
    return;
  }

  // No match selected yet OR switching to better match
  if (match.id !== CURRENT_MATCH_ID) {
    console.log(`🔄 Switching to: ${match.name}`);

    // reset memory
    LAST_BALL_ID = null;
    LAST_SESSION = "";
    LAST_WINNER = "";
    LAST_TOSS_DONE = false;

    CURRENT_MATCH_ID = match.id;
    CURRENT_MATCH_NAME = match.name;

    if (!firstTime) {
      await postTweet(`🆕 Switching to higher priority match: ${match.name}`);
    }
  }
}

// 🔁 Poll live data
async function pollLoop() {
  if (!CURRENT_MATCH_ID) {
    return setTimeout(pollLoop, POLL_INTERVAL);
  }

  try {
    const commentary = await fetchCommentary(CURRENT_MATCH_ID);
    const scorecard = await fetchScorecard(CURRENT_MATCH_ID);

    const innings = scorecard?.scorecard?.[0];
    if (!innings) {
      return setTimeout(pollLoop, POLL_INTERVAL);
    }

    const event = detectEvent(commentary, scorecard, innings);

    if (event) {
      console.log("🔥 Event:", event.type);

      const eventText = await generateTweet(event);
      const tweet = buildFinalTweet(CURRENT_MATCH_NAME, eventText);

      await postTweet(tweet);
      console.log("🟢 Tweet posted!");
    } else {
      console.log("🟡 No new event");
    }
  } catch (err) {
    console.log("❌ Polling error:", err.message);
  }

  setTimeout(pollLoop, POLL_INTERVAL);
}

// 🔁 Auto-switching loop
async function switchLoop() {
  await pickMatch(false);
  setTimeout(switchLoop, SWITCH_INTERVAL);
}

// 🎯 Event detection
function detectEvent(commentary, scorecard, innings) {
  // TOSS
  if (!LAST_TOSS_DONE && commentary?.matchHeader?.tossResults) {
    LAST_TOSS_DONE = true;
    const toss = commentary.matchHeader.tossResults;

    return {
      type: "TOSS",
      wonBy: toss.tossWinnerName,
      decision: toss.decision.toUpperCase(),
    };
  }

  // SESSION EVENTS
  const status = scorecard.status || "";

  if (
    status.includes("Lunch") ||
    status.includes("Tea") ||
    status.includes("Stumps")
  ) {
    const session = status.includes("Lunch")
      ? "LUNCH"
      : status.includes("Tea")
      ? "TEA"
      : "STUMPS";

    if (LAST_SESSION !== session) {
      LAST_SESSION = session;
      return {
        type: "SESSION",
        session,
        runs: innings.score,
        wickets: innings.wickets,
        overs: innings.overs,
        battingTeam: innings.batteamname,
      };
    }
  }

  // BALL EVENT
  const lastBall = commentary.commentaryList?.find(
    (x) => x.eventType === "BALL"
  );
  if (lastBall) {
    if (lastBall.id !== LAST_BALL_ID) {
      LAST_BALL_ID = lastBall.id;

      const isSix = lastBall.event?.includes("SIX");
      const isWicket = lastBall.event?.includes("WICKET");

      if (isSix) {
        return {
          type: "SIX",
          batsman: lastBall.batsmanName,
          bowler: lastBall.bowlerName,
          score: innings.score,
          wickets: innings.wickets,
          overs: innings.overs,
        };
      }

      if (isWicket) {
        return {
          type: "WICKET",
          batsman: lastBall.batsmanName,
          bowler: lastBall.bowlerName,
          fielder: lastBall.fielderName,
          score: innings.score,
          wickets: innings.wickets,
          overs: innings.overs,
        };
      }
    }
  }

  // MATCH END
  if (scorecard.ismatchcomplete && LAST_WINNER !== scorecard.status) {
    LAST_WINNER = scorecard.status;
    return {
      type: "MATCH_END",
      result: scorecard.status,
    };
  }

  return null;
}

startBot();
