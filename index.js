// index.js
import dotenv from "dotenv";
dotenv.config();

import { loadState, saveState } from "./utils/stateStoreCloud.js";
import { createLogger } from "./utils/logger.js";

import { bbcNewsPollingLoop } from "./bbc/bbcNewsPollingLoop.js";
import { cricbuzzNewsPollingLoop } from "./cricbuzz/cricbuzzNewsPollingLoop.js";
import { ieNewsPollingLoop } from "./indian-express/ieNewsPollingLoop.js";
import { hinduNewsPollingLoop } from "./thehindu/hinduNewsPollingLoop.js";
import { probatsmanNewsPollingLoop } from "./pro-batsman/probatsmanNewsPollingLoop.js";
import { geminiDiscoveryLoop } from "./google-news/ai/geminiDiscoveryLoop.js";
import { googleNewsPollingLoop } from "./google-news/googleNewsPooling.js";

const log = createLogger("prod");

async function bootstrap() {
  global.STATE = await loadState();

  log("🌍 JSONBin state loaded:", true);
  log(global.STATE, true);

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
    setInterval(cricbuzzNewsPollingLoop, 1000 * 60 * 15);
  }

  if (process.env.ENABLE_BBC_NEWS_POLLING === "true") {
    console.log("📰 BBC news polling enabled");
    setInterval(bbcNewsPollingLoop, 1000 * 60 * 2);
  }

  if (process.env.ENABLE_IE_NEWS_POLLING === "true") {
    console.log("📰 Indian Express news polling enabled");
    setInterval(ieNewsPollingLoop, 1000 * 60 * 3);
  }

  if (process.env.ENABLE_HINDU_NEWS_POLLING === "true") {
    console.log("📰 The Hindu news polling enabled");
    setInterval(hinduNewsPollingLoop, 1000 * 60 * 5);
  }
  if (process.env.ENABLE_PROBATSMAN_NEWS_POLLING === "true") {
    console.log("📰 ProBatsman news polling enabled");
    setInterval(probatsmanNewsPollingLoop, 1000 * 60 * 8);
  }

  if (process.env.ENABLE_GEMINI_NEWS_POLLING === "true") {
    console.log("🧠 Gemini discovery polling enabled for crex-news");
    setInterval(googleNewsPollingLoop, 1000 * 60 * 10);
  }
}

bootstrap();
