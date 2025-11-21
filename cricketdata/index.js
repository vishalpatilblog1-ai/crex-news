import "dotenv/config";

import generateTweet from "./ai.js";
import postTweet from "./twitter.js";
import { getMatchScore } from "./cricketApi.js";
import { detectEvents } from "./events.js";

const MATCH_ID = "YOUR_MATCH_ID_HERE"; // paste tomorrow’s IND vs SA match ID

async function runLiveBot() {
  console.log("🔁 Checking for new events...");

  try {
    const score = await getMatchScore(MATCH_ID);
    const event = detectEvents(score);

    if (event) {
      console.log("🔥 New Event Detected:", event.type);

      const tweet = await generateTweet(event.data);
      await postTweet(tweet);

      console.log("🟢 Tweet posted for:", event.type);
    }
  } catch (err) {
    console.error("❌ Error in loop:", err);
  }

  setTimeout(runLiveBot, 5000); // runs every 5 sec
}

runLiveBot();
