// index.js
import dotenv from "dotenv";
dotenv.config();

import { loadState } from "./utils/stateStoreCloud.js";
import { createLogger } from "./utils/logger.js";

import { bbcNewsPollingLoop } from "./bbc/bbcNewsPollingLoop.js";
import { cricbuzzNewsPollingLoop } from "./cricbuzz/cricbuzzNewsPollingLoop.js";
import { ieNewsPollingLoop } from "./indian-express/ieNewsPollingLoop.js";

global.BBC_STATE_READY = false;

const log = createLogger("prod");
console.log("BBC polling started v2");

async function bootstrap() {
  global.STATE = await loadState();
  global.BBC_STATE_READY = true;

  log("🌍 JSONBin state loaded:", true);
  log(global.STATE, true);

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
    setInterval(ieNewsPollingLoop, 1000 * 60 * 2);
  }
}

bootstrap();
