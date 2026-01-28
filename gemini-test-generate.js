import { generateGeminiCAtweetSignal } from "./cricket-addictor/ai/generateGeminiCAtweetSignal.js";
import { caNewsPollingLoop } from "./cricket-addictor/caNewsPollingLoop.js";
import { geminiDiscoveryLoop } from "./google-news/ai/geminiDiscoveryLoop.js";
import { generateGroundedGullyTweet } from "./google-news/ai/generateGroundedGullyTweet.js";
import { loadState } from "./utils/stateStoreCloud.js";

async function runTest() {
  global.STATE = await loadState();
  await caNewsPollingLoop();
}

runTest();
