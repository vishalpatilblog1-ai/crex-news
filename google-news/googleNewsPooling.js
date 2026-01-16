// import { geminiDiscoveryLoop } from "./google-news/ai/geminiDiscoveryLoop.js";
// import { generateGroundedGullyTweet } from "./google-news/ai/generateGroundedGullyTweet.js";

import { geminiDiscoveryLoop } from "./ai/geminiDiscoveryLoop.js";
import { generateGroundedGullyTweet } from "./ai/generateGroundedGullyTweet.js";

let isRunning = false;

export async function googleNewsPollingLoop() {
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
    console.log("🟢 Gemini news detected — generating tweet");
    await generateGroundedGullyTweet(decision);
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
