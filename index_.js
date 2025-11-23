// index.js — Final Combined Version
//-----------------------------------

import dotenv from "dotenv";
import postTweet from "./twitter.js";

import { findBestLiveMatch } from "./findBestLiveMatch.js";
import generateTweet from "./ai.js";

import { extractDetailsFromCommentary } from "./cricbuzz/commentaryParser.js";
import { detectEvents } from "./cricbuzz/events.js";

import { getCommentary, getMatchScore } from "./cricbuzz/cricbuzzApi.js";

dotenv.config();

let CURRENT_MATCH_ID = null;
let CURRENT_MATCH_NAME = "";

// INTERVALS
const POLL_INTERVAL = 15000; // every 15 sec
const SWITCH_INTERVAL = 60000; // every 60 sec

async function startBot() {
  console.log("🚀 Starting Live Cricket Bot…");

  await pickMatch(true); // pick at startup

  pollLoop(); // fetch events
  switchLoop(); // change match if needed
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
  }
}

async function pollLoop() {
  if (!CURRENT_MATCH_ID) {
    return setTimeout(pollLoop, POLL_INTERVAL);
  }

  try {
    console.log("🔄 Polling match:", CURRENT_MATCH_NAME);

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

      // AI-generated tweet
      const tweetText = await generateTweet(payload);
      await postTweet(tweetText);

      console.log("🟢 Tweet posted!");
    } else {
      console.log("🟡 No new event.");
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

// START SCRIPT
startBot();
