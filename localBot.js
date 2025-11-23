// localBot.js — Guaranteed working (Forced match mode)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import dotenv from "dotenv";
dotenv.config();

import { getMatchScore, getCommentary } from "./cricbuzz/cricbuzzApi.js";
import { detectEvents, setTeams } from "./cricbuzz/events.js";
import { extractDetailsFromCommentary } from "./cricbuzz/commentaryParser.js";
import generateTweet from "./ai.js";
import { initPuppeteer } from "./Puppeteer/postTweet.js";

// 🚨 Forced match for local (works even if Cricbuzz blocks your IP)
const FORCE_MATCH_ID = 117380;
const FORCE_MATCH_NAME = "South Africa vs India";
const FORCE_TEAM1 = "South Africa";
const FORCE_TEAM2 = "India";

let CURRENT_MATCH_ID = FORCE_MATCH_ID;
let CURRENT_MATCH_NAME = FORCE_MATCH_NAME;
let TEAM1 = FORCE_TEAM1;
let TEAM2 = FORCE_TEAM2;

setTeams(TEAM1, TEAM2);
console.log("⚡ Forced match enabled for local testing");

const POLL_INTERVAL = 15000;

async function startBot() {
  console.log("🚀 Starting Local Puppeteer Cricket Bot…");
  await initPuppeteer();
  pollLoop();
}

async function pollLoop() {
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

      console.log("🎯 Final Payload:", payload);

      const tweetText = await generateTweet(payload);

      const { postTweet } = await import("./Puppeteer/postTweet.js");
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

startBot();
