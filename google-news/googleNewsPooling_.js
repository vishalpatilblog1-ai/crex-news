// import { geminiDiscoveryLoop } from "./google-news/ai/geminiDiscoveryLoop.js";
// import { generateGroundedGullyTweet } from "./google-news/ai/generateGroundedGullyTweet.js";

import { generateGeminiTweet } from "../ai/generate-gemini-tweet.js";
import { generateGPTTweet } from "../ai/generate-gpt-tweet.js";
import { geminiDiscoveryLoop } from "./ai/geminiDiscoveryLoop.js";
import { generateGroundedGullyTweet } from "./ai/generateGroundedGullyTweet.js";

let isRunning = false;

export async function googleNewsPollingLoop() {
  console.log("googleNewsPollingLoop..");
  if (isRunning) {
    console.log("⏳ Gemini loop already running, skipping");
    return;
  }

  isRunning = true;
  try {
    const decision = await geminiDiscoveryLoop();
    if (!decision) {
      console.log("🟡 No new Gemini news to tweet");
      return;
    }
    console.log("🟢 Gemini news detected — generating tweet", decision);
    // await generateGroundedGullyTweet(decision);
    let tweetText;
    try {
      tweetText = await generateGeminiTweet(`${decision?.articleFullText}`);
    } catch (err) {
      console.warn("⚠️ Gemini failed:", err?.message || err);
    }

    if (!tweetText) {
      try {
        tweetText = await generateGPTTweet(`${decision?.articleFullText}`);
      } catch (err) {
        console.warn("❌ GPT failed:", err?.message || err);
      }
    }

    console.log("final tweet::", tweetText);
  } finally {
    isRunning = false;
  }
}

// export async function googleNewsPollingLoop() {
//   try {
//     const decision = await geminiDiscoveryLoop();

//     if (!decision) {
//       console.log("🟡 No new Gemini news to tweet");
//       return;
//     }

//     console.log("🟢 Gemini news detected — generating tweet");

//     await generateGroundedGullyTweet(decision);
//   } catch (err) {
//     console.error("❌ Gemini polling error:", err);
//   }
// }
