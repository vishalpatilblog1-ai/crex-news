// index.js
import dotenv from "dotenv";
dotenv.config();

import { loadState, saveState } from "./utils/stateStoreCloud.js";
import { createLogger } from "./utils/logger.js";

import { caNewsPollingLoop } from "./cricket-addictor/caNewsPollingLoop.js";
import { ctNewsPollingLoop } from "./crictracker/ctNewsPollingLoop.js";

const log = createLogger("prod");

/* ------------------------------------------------------------------
   Global runtime state
------------------------------------------------------------------- */
global.STATE = null;
global.LAST_CA_SUCCESS_AT = 0;
global.CA_COOLDOWN_UNTIL = 0;

/* ------------------------------------------------------------------
   Safe CA polling
------------------------------------------------------------------- */
async function safeCaPolling() {
  console.log("inside safeCaPolling ...");

  if (Date.now() < global.CA_COOLDOWN_UNTIL) {
    console.log("⏳ CA cooldown active — skipping");
    return;
  }

  try {
    const didPost = await caNewsPollingLoop();

    // caNewsPollingLoop should return true if it posted / processed news
    if (didPost) {
      global.LAST_CA_SUCCESS_AT = Date.now();
      console.log("✅ CA success recorded");
    }
  } catch (err) {
    console.warn("⚠️ CA polling error:", err?.message || err);

    // Backoff CA aggressively on failure
    global.CA_COOLDOWN_UNTIL = Date.now() + 15 * 60 * 1000;
    console.log("🛑 CA cooldown activated — 15 min");
  }
}

/* ------------------------------------------------------------------
   Safe CT polling (fallback)
------------------------------------------------------------------- */
async function safeCtPolling() {
  console.log("inside safeCtPolling ...");

  const sinceLastCA = Date.now() - (global.LAST_CA_SUCCESS_AT || 0);

  // CT only runs if CA inactive for 30 min
  if (sinceLastCA < 30 * 60 * 1000) {
    console.log("⏭️ CT skipped — CA active recently");
    return;
  }

  try {
    await ctNewsPollingLoop();
  } catch (err) {
    console.warn("⚠️ CT polling error:", err?.message || err);
  }
}

/* ------------------------------------------------------------------
   Bootstrap
------------------------------------------------------------------- */
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

  /* ---------------- CA ---------------- */
  if (process.env.ENABLE_CRICKETADDICTOR_NEWS_POLLING === "true") {
    console.log("🧠 CricketAddictor polling enabled");

    safeCaPolling();

    setInterval(() => {
      const jitter = Math.floor(Math.random() * 60_000);
      setTimeout(safeCaPolling, jitter);
    }, 1000 * 60 * 7);
  }

  if (process.env.ENABLE_CRICKTRACKER_NEWS_POLLING === "true") {
    setTimeout(() => {
      console.log("🧠 CricTracker fallback polling enabled");

      safeCtPolling();

      setInterval(safeCtPolling, 1000 * 60 * 6);
    }, 1000 * 60 * 10);
  }
}

bootstrap();
