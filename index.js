// index.js
import dotenv from "dotenv";
dotenv.config();

import { loadState } from "./utils/stateStoreCloud.js";
import { createLogger } from "./utils/logger.js";

import { bbcNewsPollingLoop } from "./bbc/bbcNewsPollingLoop.js";
import { cricbuzzNewsPollingLoop } from "./cricbuzz/cricbuzzNewsPollingLoop.js";
import { ieNewsPollingLoop } from "./indian-express/ieNewsPollingLoop.js";
import { hinduNewsPollingLoop } from "./thehindu/hinduNewsPollingLoop.js";

// global.BBC_STATE_READY = false;

const log = createLogger("prod");
// console.log("BBC polling started v2");

async function bootstrap() {
  global.STATE = await loadState();
  // global.BBC_STATE_READY = true;

  log("🌍 JSONBin state loaded:", true);
  log(global.STATE, true);

  const today = new Date().toISOString().slice(0, 10);
  if (!STATE.dailyContext || STATE.dailyContext.date !== today) {
    STATE.dailyContext = {
      date: today,
      contexts: [],
    };
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
    setInterval(ieNewsPollingLoop, 1000 * 60 * 5);
  }

  if (process.env.ENABLE_HINDU_NEWS_POLLING === "true") {
    console.log("📰 The Hindu news polling enabled");
    setInterval(hinduNewsPollingLoop, 1000 * 60 * 10);
  }
}

bootstrap();
