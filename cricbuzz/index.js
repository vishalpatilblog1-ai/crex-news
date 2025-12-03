// cricbuzz/index.js — FINAL, STABLE, INNINGS-BASED, DUPLICATE-SAFE VERSION
import dotenv from "dotenv";
dotenv.config();

import { createLogger } from "../utils/logger.js";

import { loadState } from "../utils/stateStoreCloud.js";

import { findIndiaMatch } from "./cricbuzzApi.js";
import { newsPollingLoop } from "./loops/newsPollingLoop.js";
import { scorePollingLoop } from "./loops/scorePollingLoop.js";

globalThis.LAST_INNINGS = null;
globalThis.LAST_OVER = null;
globalThis.LAST_BALL = null;
globalThis.LAST_EVENT_BALL = {};
globalThis.PREV_INNINGS_ID = null;
globalThis.PREV_BATTEAM = null;
globalThis.PREV_SNAPSHOT = null;

const FORCE_MATCH_ID = process.env.FORCE_MATCH_ID
  ? Number(process.env.FORCE_MATCH_ID)
  : null;

// const FORCE_MATCH_ID = 134100;

// "toss_117389": true,
// "result_135063": true,

let MATCH_ID = FORCE_MATCH_ID || 0;
let MATCH_NAME = FORCE_MATCH_ID ? `Forced Match #${FORCE_MATCH_ID}` : "";

const log = createLogger("prod");

const wait = (ms) => new Promise((res) => setTimeout(res, ms));

async function startBot() {
  if (MATCH_ID) {
    log(`🎯 Using forced MATCH_ID: ${MATCH_ID}`);
    scorePollingLoop(MATCH_ID, "");
    return;
  }

  log("🔎 Searching for LIVE India match...");

  while (!MATCH_ID) {
    try {
      const match = await findIndiaMatch();

      if (match) {
        MATCH_ID = match.id;
        MATCH_NAME = match.name;
        log(`✅ Found LIVE match: ${MATCH_NAME}`);
        break;
      }

      log("⏳ No India match yet… retrying in 30s");
      await wait(30000);
    } catch (err) {
      console.error("❌ Error while searching match:", err);
      await wait(30000);
    }
  }

  scorePollingLoop(MATCH_ID, MATCH_NAME);
}

async function bootstrap() {
  global.STATE = await loadState();
  console.log("🌍 JSONBin state loaded:", global.STATE);

  if (process.env.ENABLE_SCORE_POLLING === "true") {
    console.log("before startBot ....");
    await startBot();
  }

  if (process.env.ENABLE_NEWS_POLLING === "false") {
    setInterval(newsPollingLoop, 1000 * 60 * 10);
  }
}

bootstrap();
