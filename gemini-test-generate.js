import { geminiDiscoveryLoop } from "./google-news/ai/geminiDiscoveryLoop.js";
import { generateGroundedGullyTweet } from "./google-news/ai/generateGroundedGullyTweet.js";

async function runTest() {
  try {
    const tweet_spice = await geminiDiscoveryLoop();
    if (!tweet_spice) {
      console.log("🟡 No new Gemini news to tweet");
      return;
    }
    const finalTweet = await generateGroundedGullyTweet(tweet_spice);
    console.log("✅ AI spice Tweet Output:");
    // console.log(finalTweet);
  } catch (err) {
    console.error("❌ TEST FAILED:", err.message);
  }
}

runTest();
