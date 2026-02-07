// index.js
import dotenv from "dotenv";
dotenv.config();

import { loadState, saveState } from "./utils/stateStoreCloud.js";
import { createLogger } from "./utils/logger.js";

import { caNewsPollingLoop } from "./cricket-addictor/caNewsPollingLoop.js";
import { ctNewsPollingLoop } from "./crictracker/ctNewsPollingLoop.js";
import { cricbuzzNewsPollingLoop } from "./cricbuzz/cricbuzzNewsPollingLoop.js";
import { ieNewsPollingLoop } from "./indian-express/ieNewsPollingLoop.js";
import { tryFlushTweetQueue } from "./twitter/tweetQueue.js";
// import { tryFlushTweetQueue } from "./twitter/tweetQueue.js";

// setInterval(() => {
//   tryFlushTweetQueue();
// }, 15 * 1000);

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

// const MIN_CA_INTERVAL = 20 * 60 * 1000;
// const MAX_CA_INTERVAL = 35 * 60 * 1000;

const MIN_CA_INTERVAL = 15 * 60 * 1000;
const MAX_CA_INTERVAL = 20 * 60 * 1000;

function randomDelay(min, max) {
  return min + Math.floor(Math.random() * (max - min));
}
async function safeCaPolling() {
  console.log("inside safeCaPolling ...");

  if (Date.now() < global.CA_COOLDOWN_UNTIL) {
    console.log("⏳ CA cooldown active — skipping");
    return;
  }

  try {
    const didPost = await caNewsPollingLoop();

    if (didPost) {
      global.LAST_CA_SUCCESS_AT = Date.now();
      console.log("✅ CA success recorded");
    }
  } catch (err) {
    console.warn("⚠️ CA polling error:", err?.message || err);

    global.CA_COOLDOWN_UNTIL = Date.now() + 15 * 60 * 1000;
    console.log("🛑 CA cooldown activated — 15 min...");
  }
}

/* ------------------------------------------------------------------
   Safe CT polling (fallback)
------------------------------------------------------------------- */
async function safeCtPolling() {
  console.log("inside safeCtPolling ...");

  const sinceLastCA = Date.now() - (global.LAST_CA_SUCCESS_AT || 0);

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

async function scheduleCaPolling() {
  try {
    await safeCaPolling();
  } catch (err) {
    console.error("❌ CA polling error, backing off:", err.message);

    setTimeout(scheduleCaPolling, 6 * 60 * 60 * 1000);
    return;
  }

  const nextDelay = randomDelay(MIN_CA_INTERVAL, MAX_CA_INTERVAL);
  console.log(
    `⏳ Next CricketAddictor poll in ${Math.round(nextDelay / 60000)} min`
  );

  setTimeout(scheduleCaPolling, nextDelay);
}

async function bootstrap() {
  global.STATE = await loadState();

  // Start global tweet queue flusher AFTER state is ready
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

  // if (process.env.ENABLE_CRICKETADDICTOR_NEWS_POLLING === "true") {
  //   console.log("🧠 CricketAddictor polling enabled");
  //   setTimeout(scheduleCaPolling, 5 * 60 * 1000);
  // }

  // if (process.env.ENABLE_IE_NEWS_POLLING === "true") {
  //   console.log("📰 Indian Express news polling enabled");
  //   setInterval(ieNewsPollingLoop, 1000 * 60 * 0.15);
  // }

  //================================================================================

  // if (process.env.ENABLE_CRICKETADDICTOR_NEWS_POLLING === "true") {
  //   console.log("🧠 CricketAddictor polling enabled");
  //   setTimeout(scheduleCaPolling, 5 * 60 * 1000);
  // }

  // if (process.env.ENABLE_CRICKETADDICTOR_NEWS_POLLING === "true") {
  //   console.log("🧠 CricketAddictor polling enabled");
  //   setTimeout(caNewsPollingLoop, 15 * 60 * 1000);
  // }

  // if (process.env.ENABLE_CRICBUZZ_NEWS_POLLING === "true") {
  //   console.log("📰 Cricbuzz news polling enabled");
  //   setInterval(cricbuzzNewsPollingLoop, 1000 * 60 * 10);
  // }

  if (process.env.ENABLE_CRICKETADDICTOR_NEWS_POLLING === "true") {
    console.log("🧠 CricketAddictor polling enabled");
    setTimeout(scheduleCaPolling, 5 * 60 * 1000);
  }

  if (process.env.ENABLE_CRICKTRACKER_NEWS_POLLING === "true") {
    setTimeout(() => {
      console.log("🧠 CricTracker fallback polling enabled");

      safeCtPolling();

      setInterval(safeCtPolling, 1000 * 60 * 6);
    }, 1000 * 60 * 10);
  }

  //================================================================================

  // enque tested
  // if (process.env.ENABLE_CRICKTRACKER_NEWS_POLLING === "true") {
  //   setTimeout(() => {
  //     console.log("🧠 CricTracker fallback polling enabled");

  //     safeCtPolling();

  //     setInterval(safeCtPolling, 1000 * 60 * 0.2);
  //   }, 0);
  // }

  // if (process.env.ENABLE_CRICKETADDICTOR_NEWS_POLLING === "true") {
  //   console.log("🧠 CricketAddictor polling enabled");
  //   setTimeout(scheduleCaPolling, 5 * 60 * 0.1);
  // }

  // if (process.env.ENABLE_CRICBUZZ_NEWS_POLLING === "true") {
  //   console.log("📰 Cricbuzz news polling enabled");
  //   setInterval(cricbuzzNewsPollingLoop, 1000 * 60 * 0.1);
  // }
}

bootstrap();
