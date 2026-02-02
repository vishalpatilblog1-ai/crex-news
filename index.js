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
import { caNewsPollingLoop } from "./cricket-addictor/caNewsPollingLoop.js";
import { ctNewsPollingLoop } from "./crictracker/ctNewsPollingLoop.js";

const log = createLogger("prod");

/* ------------------------------------------------------------------
   Gemini safety gate (ONLY affects CA & CT)
------------------------------------------------------------------- */
global.GEMINI_BUSY = false;
global.GEMINI_COOLDOWN_UNTIL = 0;
global.LAST_CA_SUCCESS_AT = 0;

function canUseGemini() {
  return !global.GEMINI_BUSY && Date.now() > global.GEMINI_COOLDOWN_UNTIL;
}

/* ------------------------------------------------------------------
   Safe wrappers (old logic preserved, just guarded)
------------------------------------------------------------------- */
async function safeCaPolling() {
  console.log("inside safeCaPolling ...");
  // if (!canUseGemini()) {
  //   console.log("⏭️ CA skipped — Gemini busy/cooldown");
  //   return;
  // }

  try {
    global.GEMINI_BUSY = true;
    await caNewsPollingLoop();
  } catch (err) {
    if (err?.status === 429) {
      global.GEMINI_COOLDOWN_UNTIL = Date.now() + 30 * 60 * 1000;
      console.log("🛑 Gemini cooldown activated (CA) — 30 min");
    }
    console.warn("⚠️ CA polling error:", err?.message || err);
  } finally {
    global.GEMINI_BUSY = false;
  }
}

async function safeCtPolling() {
  console.log("inside safeCtPolling ...");
  // if (!canUseGemini()) {
  //   console.log("⏭️ CT skipped — Gemini busy/cooldown");
  //   return;
  // }

  // CT = fallback → run only if CA inactive for 30 min
  const sinceLastCA = Date.now() - (global.LAST_CA_SUCCESS_AT || 0);

  if (sinceLastCA < 30 * 60 * 1000) {
    console.log("⏭️ CT skipped — CA active recently");
    return;
  }

  try {
    global.GEMINI_BUSY = true;
    await ctNewsPollingLoop();
  } catch (err) {
    if (err?.status === 429) {
      global.GEMINI_COOLDOWN_UNTIL = Date.now() + 30 * 60 * 1000;
      console.log("🛑 Gemini cooldown activated (CT) — 30 min");
    }
    console.warn("⚠️ CT polling error:", err?.message || err);
  } finally {
    global.GEMINI_BUSY = false;
  }
}

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
    setInterval(ieNewsPollingLoop, 1000 * 60 * 10);
  }

  if (process.env.ENABLE_HINDU_NEWS_POLLING === "true") {
    console.log("📰 The Hindu news polling enabled");
    setInterval(hinduNewsPollingLoop, 1000 * 60 * 15);
  }

  if (process.env.ENABLE_PROBATSMAN_NEWS_POLLING === "true") {
    console.log("📰 ProBatsman news polling enabled");
    setInterval(probatsmanNewsPollingLoop, 1000 * 60 * 8);
  }

  if (process.env.ENABLE_GEMINI_NEWS_POLLING === "true") {
    console.log("🧠 Gemini discovery polling enabled for crex-news");
    setInterval(googleNewsPollingLoop, 1000 * 60 * 10);
  }

  if (process.env.ENABLE_CRICKETADDICTOR_NEWS_POLLING === "true") {
    console.log("🧠 cricketaddictor news polling enabled for crex-news");
    safeCaPolling();
    setInterval(safeCaPolling, 1000 * 60 * 2);
  }

  if (process.env.ENABLE_CRICKTRACKER_NEWS_POLLING === "true") {
    setTimeout(() => {
      console.log("🧠 cricktracker news polling enabled for crex-news");
      safeCtPolling();
      setInterval(safeCtPolling, 1000 * 60 * 5);
    }, 1000 * 60 * 6);
  }
}

bootstrap();
