// index.js
import dotenv from "dotenv";
dotenv.config();

import { createLogger } from "./utils/logger.js";
import { loadState, saveState } from "./utils/stateStoreCloud.js";
import { cricbuzzNewsPollingLoop } from "./cricbuzz/cricbuzzNewsPollingLoop.js";
import { ieNewsPollingLoop } from "./indian-express/ieNewsPollingLoop.js";
import { tryFlushTweetQueue } from "./twitter/tweetQueue.js";
import { hinduNewsPollingLoop } from "./thehindu/hinduNewsPollingLoop.js";

const log = createLogger("prod");

global.STATE = null;
global.LAST_CA_SUCCESS_AT = 0;
global.CA_COOLDOWN_UNTIL = 0;

async function bootstrap() {
  global.STATE = await loadState();

  setInterval(async () => {
    try {
      console.log("tryFlushTweetQueue::");
      await tryFlushTweetQueue();
    } catch (err) {
      console.error("❌ Queue flush error:", err?.message || err);
    }
  }, 15 * 1000);

  log("🌍 JSONBin state loaded:", true);
  log(global.STATE, true);
  global.STATE.tweetQueue ??= [];

  const today = new Date().toISOString().slice(0, 10);

  if (!global.STATE.dailyContext || global.STATE.dailyContext.date !== today) {
    console.log("🗓️ Initializing dailyContext for", today);
    global.STATE.dailyContext = {
      date: today,
      contexts: [],
    };
    await saveState(global.STATE);
  }

  if (process.env.ENABLE_CRICBUZZ_NEWS_POLLING === "true") {
    console.log("📰 Cricbuzz news polling enabled");
    setInterval(cricbuzzNewsPollingLoop, 1000 * 60 * 10);
  }

  if (process.env.ENABLE_IE_NEWS_POLLING === "true") {
    console.log("📰 Indian Express news polling enabled");
    setInterval(ieNewsPollingLoop, 1000 * 60 * 8);
  }

  if (process.env.ENABLE_HINDU_NEWS_POLLING === "true") {
    console.log("The Hindu news polling enabled");
    setInterval(hinduNewsPollingLoop, 1000 * 60 * 6);
  }
}

bootstrap();
