// index.js
import dotenv from "dotenv";

import { startBrowser } from "./Puppeteer/browser.js";
import postTweet from "./twitter.js";

import {
  fetchCommentary,
  fetchScorecard,
} from "./Puppeteer/fetchCricbuzzViaBrowser.js";

import { findAnyLiveMatch } from "./Puppeteer/findAnyLiveMatch.js";
import generateTweet from "./ai.js";
import { buildFinalTweet } from "./utils/matchFormatting.js";

dotenv.config();

const MATCH_POLL_INTERVAL = 15000;

// STATE KEEPERS
let LAST_BALL_ID = null;
let LAST_SESSION = "";
let LAST_WINNER = "";
let LAST_TOSS_DONE = false;
let LAST_50 = new Set();
let LAST_PARTNERSHIP_50 = new Set();

async function startBot() {
  console.log("🚀 Starting bot with Puppeteer…");

  await startBrowser(); // FIXED

  console.log("🔎 Searching for ANY live match…");

  // 🔥 AUTO-DETECT LIVE MATCH
  const match = await findAnyLiveMatch();

  if (!match) {
    console.log("❌ No live match found.");
    return process.exit(0);
  }

  console.log(`🏏 LIVE MATCH FOUND: ${match.name}`);
  console.log(`📌 MATCH_ID = ${match.id}`);

  pollLoop(match.id, match.name); // FIXED
}

async function pollLoop(matchId, matchName) {
  try {
    const commentary = await fetchCommentary(matchId);
    const scorecard = await fetchScorecard(matchId);

    if (!scorecard?.scorecard?.[0]) {
      console.log("⚠ No innings found");
      return setTimeout(
        () => pollLoop(matchId, matchName),
        MATCH_POLL_INTERVAL
      );
    }

    const innings = scorecard.scorecard[0];

    console.log(
      `📊 Score: ${innings.score}/${innings.wickets} (${innings.overs})`
    );

    const event = detectEvent(commentary, scorecard, innings);

    if (event) {
      console.log("🔥 Event detected:", event.type);

      // Generate AI tweet
      const eventText = await generateTweet(event); // FIXED

      // Format tweet with team emojis + title
      const finalTweet = buildFinalTweet(matchName, eventText); // FIXED

      await postTweet(finalTweet);

      console.log("🟢 Tweet posted!");
    } else {
      console.log("🟡 No event yet...");
    }
  } catch (e) {
    console.log("❌ Error:", e.message);
  }

  setTimeout(() => pollLoop(matchId, matchName), MATCH_POLL_INTERVAL);
}

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
  if (
    scorecard.status.includes("Lunch") ||
    scorecard.status.includes("Tea") ||
    scorecard.status.includes("Stumps")
  ) {
    const session = scorecard.status.includes("Lunch")
      ? "LUNCH"
      : scorecard.status.includes("Tea")
      ? "TEA"
      : "STUMPS";

    if (LAST_SESSION !== session) {
      LAST_SESSION = session;
      return {
        type: "SESSION",
        session,
        battingTeam: innings.batteamname,
        runs: innings.score,
        wickets: innings.wickets,
        overs: innings.overs,
      };
    }
  }

  // BALL-BY-BALL
  const lastBall = commentary.commentaryList?.find(
    (x) => x?.eventType === "BALL"
  );

  if (lastBall) {
    const ballId = lastBall.id;

    if (ballId !== LAST_BALL_ID) {
      LAST_BALL_ID = ballId;

      const batsman = lastBall.batsmanName || "";
      const bowler = lastBall.bowlerName || "";
      const isSix = lastBall.event?.includes("SIX");
      const isWicket = lastBall.event?.includes("WICKET");

      if (isSix) {
        return {
          type: "SIX",
          batsman,
          bowler,
          score: innings.score,
          wickets: innings.wickets,
          overs: innings.overs,
        };
      }

      if (isWicket) {
        return {
          type: "WICKET",
          batsman,
          bowler,
          fielder: lastBall.fielderName || "",
          score: innings.score,
          wickets: innings.wickets,
          overs: innings.overs,
        };
      }
    }
  }

  // BATSMAN 50
  for (const b of innings.batsman || []) {
    if (b.runs >= 50 && b.runs % 50 === 0 && !LAST_50.has(b.id)) {
      LAST_50.add(b.id);
      return {
        type: "BATSMAN_50",
        name: b.name,
        runs: b.runs,
        balls: b.balls,
      };
    }
  }

  // PARTNERSHIP 50
  const lastP = innings.partnership?.partnership?.at(-1);
  if (
    lastP &&
    lastP.totalruns >= 50 &&
    !LAST_PARTNERSHIP_50.has(lastP.totalruns)
  ) {
    LAST_PARTNERSHIP_50.add(lastP.totalruns);
    return {
      type: "PARTNERSHIP_50",
      runs: lastP.totalruns,
      bat1: lastP.bat1name,
      bat2: lastP.bat2name,
    };
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
