import dotenv from "dotenv";
import { initPuppeteer, postTweet } from "./Puppeteer/postTweet.js";
// import { fetchCommentary, fetchScorecard } from "./Puppeteer/fetchCricbuzz.js";
import {
  fetchCommentary,
  fetchScorecard,
} from "./Puppeteer/fetchCricbuzzViaBrowser.js";

import generateTweet from "./ai.js";
dotenv.config();

const MATCH_POLL_INTERVAL = 15000; // 15 sec
let LAST_BALL_ID = null;
let LAST_SESSION = "";
let LAST_WINNER = "";
let LAST_TOSS_DONE = false;
let LAST_50 = new Set();
let LAST_PARTNERSHIP_50 = new Set();

async function startBot() {
  console.log("🚀 Starting bot with Puppeteer…");
  await initPuppeteer();

  console.log("🔎 Searching for live match…");

  const matchId = process.env.MATCH_ID;
  if (!matchId) {
    console.log("❌ MATCH_ID missing");
    process.exit(0);
  }

  console.log(`🏏 MATCH_ID: ${matchId}`);
  pollLoop(matchId);
}

async function pollLoop(matchId) {
  try {
    const commentary = await fetchCommentary(matchId);
    const scorecard = await fetchScorecard(matchId);

    if (!scorecard?.scorecard?.[0]) {
      console.log("⚠ No innings found");
      return setTimeout(() => pollLoop(matchId), MATCH_POLL_INTERVAL);
    }

    const innings = scorecard.scorecard[0];
    console.log(
      `📊 Score: ${innings.score}/${innings.wickets} (${innings.overs})`
    );

    const event = detectEvent(commentary, scorecard, innings);

    if (event) {
      console.log("🔥 Event detected:", event.type);

      const tweetText = await generateTweet(event);
      console.log("✍️ Generated Tweet:", tweetText);

      await postTweet(tweetText);
      console.log("🟢 Tweet posted via Puppeteer!");
    }
  } catch (err) {
    console.log("❌ Error in polling:", err.message);
  }

  setTimeout(() => pollLoop(matchId), MATCH_POLL_INTERVAL);
}

function detectEvent(commentary, scorecard, innings) {
  // -------------------------
  // 🍀 TOSS EVENT (Once only)
  // -------------------------
  if (!LAST_TOSS_DONE && commentary?.matchHeader?.tossResults) {
    LAST_TOSS_DONE = true;

    const toss = commentary.matchHeader.tossResults;
    return {
      type: "TOSS",
      wonBy: toss.tossWinnerName,
      decision: toss.decision.toUpperCase(),
      battingTeam:
        toss.decision === "bat" ? toss.tossWinnerName : toss.tossLoserName,
      bowlingTeam:
        toss.decision === "bowl" ? toss.tossWinnerName : toss.tossLoserName,
    };
  }

  // -------------------------
  // 🛏 SESSION EVENTS
  // -------------------------
  if (
    scorecard.status.includes("Lunch") ||
    scorecard.status.includes("Tea") ||
    scorecard.status.includes("Stumps")
  ) {
    const sessionType = scorecard.status.includes("Lunch")
      ? "LUNCH"
      : scorecard.status.includes("Tea")
      ? "TEA"
      : "STUMPS";

    if (LAST_SESSION !== sessionType) {
      LAST_SESSION = sessionType;
      return {
        type: "SESSION",
        session: sessionType,
        battingTeam: innings.batteamname,
        runs: innings.score,
        wickets: innings.wickets,
        overs: innings.overs,
      };
    }
  }

  // -------------------------
  // 🎯 BALL-BY-BALL EVENTS
  // -------------------------
  const lastBall = commentary.commentaryList?.find(
    (x) => x?.eventType === "BALL"
  );

  if (lastBall) {
    const ballId = lastBall.id;

    if (ballId !== LAST_BALL_ID) {
      LAST_BALL_ID = ballId;

      const text = lastBall.commentaryText?.toLowerCase() || "";
      const batsman = lastBall.batsmanName || "";
      const bowler = lastBall.bowlerName || "";
      const runs = lastBall.runs || 0;
      const isFour = lastBall.event?.includes("FOUR");
      const isSix = lastBall.event?.includes("SIX");
      const isWicket = lastBall.event?.includes("WICKET");

      // 4 or 6
      //   if (isFour || isSix) {
      //     return {
      //       type: isFour ? "FOUR" : "SIX",
      //       batsman,
      //       bowler,
      //       runs: isSix ? 6 : 4,
      //       battingTeam: innings.batteamname,
      //       score: innings.score,
      //       wickets: innings.wickets,
      //       overs: innings.overs,
      //     };
      //   }

      if (isSix) {
        return {
          type: "SIX",
          batsman,
          bowler,
          runs: 6,
          battingTeam: innings.batteamname,
          score: innings.score,
          wickets: innings.wickets,
          overs: innings.overs,
        };
      }

      if (isFour) {
        return null; // skip fours
      }

      // WICKET
      if (isWicket) {
        return {
          type: "WICKET",
          batsman,
          bowler,
          fielder: lastBall.fielderName || "",
          battingTeam: innings.batteamname,
          score: innings.score,
          wickets: innings.wickets,
          overs: innings.overs,
        };
      }
    }
  }

  // -------------------------
  // 🎉 MILESTONE (50 / 100)
  // -------------------------
  innings.batsman?.forEach((b) => {
    if (b.runs >= 50 && b.runs % 50 === 0 && !LAST_50.has(b.id)) {
      LAST_50.add(b.id);
      return {
        type: "BATSMAN_50",
        name: b.name,
        runs: b.runs,
        balls: b.balls,
        fours: b.fours,
        sixes: b.sixes,
      };
    }
  });

  // -------------------------
  // 🤝 PARTNERSHIP (50+)
  // -------------------------
  if (innings.partnership?.partnership?.length) {
    const lastP = innings.partnership.partnership.at(-1);
    if (lastP.totalruns >= 50 && !LAST_PARTNERSHIP_50.has(lastP.totalruns)) {
      LAST_PARTNERSHIP_50.add(lastP.totalruns);
      return {
        type: "PARTNERSHIP_50",
        runs: lastP.totalruns,
        bat1: lastP.bat1name,
        bat2: lastP.bat2name,
        balls: lastP.totalballs,
      };
    }
  }

  // -------------------------
  // 🏆 MATCH RESULT
  // -------------------------
  if (scorecard.ismatchcomplete && scorecard.status !== LAST_WINNER) {
    LAST_WINNER = scorecard.status;
    return {
      type: "MATCH_END",
      result: scorecard.status,
    };
  }

  return null;
}

startBot();
