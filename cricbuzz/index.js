// cricbuzz/index.js
import generateTweet from "../ai.js";
import postTweet from "../twitter.js";
import { detectEvents } from "./events.js";

import { findIndiaMatch, getMatchScore, getCommentary } from "./cricbuzzApi.js";

let MATCH_ID = null;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function startBot() {
  console.log("🔎 Searching for India vs South Africa match...");

  while (!MATCH_ID) {
    const match = await findIndiaMatch();

    if (match) {
      MATCH_ID = match.id;
      console.log(`✅ Match found: ${match.name}`);
      console.log(`🏏 MATCH_ID: ${MATCH_ID}`);
      break;
    }

    console.log("⏳ Not found. Retrying in 30 sec...");
    await wait(30000);
  }

  pollingLoop();
}

async function pollingLoop() {
  try {
    const score = await getMatchScore(MATCH_ID);
    const comm = await getCommentary(MATCH_ID);

    const event = detectEvents(score);
    console.log("Polling the data...");

    if (event) {
      console.log("🔥 Event detected:", event.type);

      const testEvent = {
        type: "FOUR",
        batsman: "Test Player",
        bowler: "Test Bowler",
        runs: 120,
        wickets: 2,
        overs: "35.4",
      };
      const tweet = await generateTweet(event);

      await postTweet(tweet);
      console.log("🟢 Tweet posted!");
    }
  } catch (err) {
    console.log("❌ Error:", err.message);
  }

  await wait(5000);
  pollingLoop();
}

startBot();
