import generateTweet from "../ai.js";
import postTweet from "../twitter.js";
// import { findTodayMatch, getMatchScore } from "./cricketApi.js";
import { findTodayMatch, getMatchScore } from "./cricketApi.js";

import { detectEvents } from "../events.js";

let CURRENT_MATCH_ID = null;

async function startBot() {
  console.log("🔎 Searching for today's India vs South Africa match...");

  while (!CURRENT_MATCH_ID) {
    try {
      const match = await findTodayMatch();

      if (match) {
        CURRENT_MATCH_ID = match.id;
        console.log("✅ Match found:", match.name);
        console.log("🏏 Using MATCH_ID:", CURRENT_MATCH_ID);
      } else {
        console.log("⏳ Match not found yet. Retrying in 30 sec...");
        await new Promise((r) => setTimeout(r, 30000));
      }
    } catch (err) {
      console.error("❌ Error finding match:", err);
    }
  }

  pollingLoop();
}

async function pollingLoop() {
  try {
    const score = await getMatchScore(CURRENT_MATCH_ID);
    const event = detectEvents(score);

    if (event) {
      console.log("🔥 New Event:", event.type);

      const tweet = await generateTweet(event.data);
      await postTweet(tweet);

      console.log("🟢 Tweet posted:", event.type);
    }
  } catch (err) {
    console.error("❌ Error in loop:", err);
  }

  setTimeout(pollingLoop, 5000);
}

startBot();
