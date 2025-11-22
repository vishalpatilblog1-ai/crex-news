// cricbuzz/index.js
import generateTweet from "../ai.js";
import postTweet from "../twitter.js";
import { detectEvents } from "./events.js";
import { extractDetailsFromCommentary } from "./commentaryParser.js";

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

    console.log("Polling the data123...");

    const event = detectEvents(score);

    if (event) {
      console.log("🔥 Event detected:", event);

      // Extract batsman / bowler / shot info safely
      const details = extractDetailsFromCommentary(comm, event.type);

      const finalEvent = {
        ...event,
        ...details,
      };

      console.log("🎯 Final event payload:", finalEvent);

      const tweetText = await generateTweet(finalEvent);
      await postTweet(tweetText);

      console.log("🟢 Tweet posted!");
    }
  } catch (err) {
    console.log("❌ Error:", err.message);
  }

  await wait(5000);
  pollingLoop();
}

startBot();
