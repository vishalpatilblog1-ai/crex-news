// liveTracker.js

import { startBrowser } from "./Puppeteer/browser.js";
import { findAnyLiveMatch } from "./Puppeteer/findAnyLiveMatch.js";
import {
  fetchScorecard,
  fetchCommentary,
} from "./Puppeteer/fetchCricbuzzViaBrowser.js";

import generateTweet from "./ai.js";
import postTweet from "./twitter.js";

import { detectEvents } from "./cricbuzz/events.js";
import { extractDetailsFromCommentary } from "./cricbuzz/commentaryParser.js";

const WAIT = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let CURRENT_MATCH_ID = null;

async function startBot() {
  console.log("🏏 Starting Auto Tweet Bot...");
  await startBrowser();

  while (true) {
    try {
      console.log("🔎 Searching for ANY LIVE MATCH...");

      const liveMatch = await findAnyLiveMatch();

      if (!liveMatch) {
        console.log("⏳ No live match. Checking... again in 60 seconds...\n");
        await WAIT(60000);
        continue;
      }

      CURRENT_MATCH_ID = liveMatch.id;
      console.log(`🔥 LIVE MATCH FOUND: ${liveMatch.name}`);
      console.log(`🏏 MATCH_ID = ${CURRENT_MATCH_ID}`);

      // Begin tracking the match
      await trackMatch(CURRENT_MATCH_ID);
    } catch (err) {
      console.log("❌ ERROR in main loop:", err.message);
    }

    await WAIT(20000); // check again every 20 seconds
  }
}

async function trackMatch(matchId) {
  console.log("➡ Fetching scorecard...");
  const score = await fetchScorecard(matchId);

  if (score.error) {
    console.log("❌ Scorecard error:", score);
    return;
  }

  console.log("➡ Fetching commentary...");
  const commentary = await fetchCommentary(matchId);

  if (commentary.error) {
    console.log("❌ Commentary error:", commentary);
    return;
  }

  // Parse commentary
  const parsed = extractDetailsFromCommentary(commentary);

  // Detect wickets, fifties, sixes, collapses, etc.
  const events = detectEvents(score, parsed);

  if (events.length === 0) {
    console.log("ℹ️ No new tweet-worthy events.\n");
    return;
  }

  for (const event of events) {
    console.log("⚡ EVENT DETECTED:", event.type);

    // AI generates tweet text
    const tweetText = await generateTweet(event);

    // Post to X / Twitter
    const posted = await postTweet(tweetText);

    console.log("🐦 Tweet posted. ID:", posted.id);
  }
}

// Start the bot
startBot();
