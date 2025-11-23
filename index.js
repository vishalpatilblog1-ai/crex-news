// index.js — Final Combined Version (with dynamic team names)
//------------------------------------------------------------

import dotenv from "dotenv";
import postTweet from "./twitter.js";

import { findBestLiveMatch } from "./findBestLiveMatch.js";
import generateTweet from "./ai.js";

import { extractDetailsFromCommentary } from "./cricbuzz/commentaryParser.js";

// 🔥 Updated: now events.js is OUTSIDE cricbuzz folder (as per your latest)

import { getCommentary, getMatchScore } from "./cricbuzz/cricbuzzApi.js";
import { detectEvents, setTeams } from "./cricbuzz/events.js";

dotenv.config();

let CURRENT_MATCH_ID = null;
let CURRENT_MATCH_NAME = "";
let TEAM1 = null;
let TEAM2 = null;

// INTERVALS
const POLL_INTERVAL = 15000; // every 15 sec
const SWITCH_INTERVAL = 60000; // every 60 sec

async function startBot() {
  console.log("🚀 Starting Live Cricket Bot…");

  await pickMatch(true);

  pollLoop();
  switchLoop();
}

async function pickMatch(firstTime = false) {
  const match = await findBestLiveMatch();

  if (!match) {
    console.log("❌ No live match found right now.");
    return;
  }

  if (match.id !== CURRENT_MATCH_ID) {
    console.log(`🔄 Switching to: ${match.name}`);

    CURRENT_MATCH_ID = match.id;
    CURRENT_MATCH_NAME = match.name;

    // 🔥 NEW: Dynamic teams
    TEAM1 = match.team1;
    TEAM2 = match.team2;

    console.log(`⚔️ Teams: ${TEAM1} vs ${TEAM2}`);

    // 🔥 Pass to events.js so bowlingTeam logic works
    setTeams(TEAM1, TEAM2);
  }
}

async function pollLoop() {
  if (!CURRENT_MATCH_ID) {
    return setTimeout(pollLoop, POLL_INTERVAL);
  }

  try {
    console.log(`🔄 Polling match: ${CURRENT_MATCH_NAME}`);

    const score = await getMatchScore(CURRENT_MATCH_ID);
    const comm = await getCommentary(CURRENT_MATCH_ID);

    if (!score?.scorecard?.[0]) {
      console.log("⚠ No innings data yet.");
      return setTimeout(pollLoop, POLL_INTERVAL);
    }

    const event = detectEvents(score);

    if (event) {
      console.log("🔥 Event detected:", event.type);

      const details = extractDetailsFromCommentary(comm, event.type);
      const payload = { ...event, ...details };

      console.log("🎯 Final Event Payload:", payload);

      const tweetText = await generateTweet(payload);
      await postTweet(tweetText);

      console.log("🟢 Tweet posted!");
    } else {
      console.log("🟡 No new event123.");
    }
  } catch (err) {
    console.log("❌ Polling Error:", err.message);
  }

  setTimeout(pollLoop, POLL_INTERVAL);
}

async function switchLoop() {
  await pickMatch(false);
  setTimeout(switchLoop, SWITCH_INTERVAL);
}

startBot();
