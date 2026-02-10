// index.js
import dotenv from "dotenv";
dotenv.config();

import { createLogger } from "./utils/logger.js";
import { loadState, saveState } from "./utils/stateStoreCloud.js";

import { cricbuzzNewsPollingLoop } from "./cricbuzz/cricbuzzNewsPollingLoop.js";
import { caNewsPollingLoop } from "./cricket-addictor/caNewsPollingLoop.js";
import { ctNewsPollingLoop } from "./crictracker/ctNewsPollingLoop.js";
import { sportskeedaNewsPollingLoop } from "./espn-cricinfo/sportskeedaNewsPollingLoop.js";
import { googleNewsPollingLoop } from "./google-news/googleNewsPooling.js";
import { ieNewsPollingLoop } from "./indian-express/ieNewsPollingLoop.js";
import { tryFlushTweetQueue } from "./twitter/tweetQueue.js";

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

const MIN_CA_INTERVAL = 5 * 60 * 1000;
const MAX_CA_INTERVAL = 10 * 60 * 1000;

function randomDelay(min, max) {
  return min + Math.floor(Math.random() * (max - min));
}

function isDayWindowIST() {
  // IST = UTC + 5:30
  const now = new Date();
  const istHour = (now.getUTCHours() + 5) % 24;
  const istMinute = now.getUTCMinutes();

  const timeInMinutes = istHour * 60 + istMinute;

  const DAY_START = 9 * 60; // 09:00
  const DAY_END = 21 * 60; // 21:00

  return timeInMinutes >= DAY_START && timeInMinutes < DAY_END;
}

async function safeCtPolling() {
  console.log("inside safeCtPolling ...");

  try {
    await ctNewsPollingLoop();
  } catch (err) {
    console.warn("⚠️ CT polling error:", err?.message || err);
  }
}

async function safeCaPolling() {
  if (!isDayWindowIST()) {
    console.log("🌙 CA polling skipped (night window 9PM–9AM IST)");
    return false; // 👈 immediate return
  }

  console.log("☀️ CA polling allowed (day window)");

  try {
    await caNewsPollingLoop();
  } catch (err) {
    console.warn("⚠️ CA polling error:", err, err?.message);
  }
}

// async function safeCaPolling() {
//   console.log("inside safeCaPolling ...");

//   try {
//     await caNewsPollingLoop();
//   } catch (err) {
//     console.warn("⚠️ CA polling error:", err, err?.message);
//   }
// }

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
  //   setInterval(ieNewsPollingLoop, 1000 * 60 * 10);
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

  if (process.env.ENABLE_CRICBUZZ_NEWS_POLLING === "true") {
    console.log("📰 Cricbuzz news polling enabled");
    setInterval(cricbuzzNewsPollingLoop, 1000 * 60 * 10);
  }

  if (process.env.ENABLE_IE_NEWS_POLLING === "true") {
    console.log("📰 Indian Express news polling enabled");
    setInterval(ieNewsPollingLoop, 1000 * 60 * 10);
  }

  // if (process.env.ENABLE_CRICKETADDICTOR_NEWS_POLLING === "true") {
  //   console.log("🧠 CricketAddictor polling enabled");
  //   setTimeout(scheduleCaPolling, 60 * 1000 * 10);
  // }
  if (process.env.ENABLE_CRICKETADDICTOR_NEWS_POLLING === "true") {
    setTimeout(() => {
      console.log("🧠 CricketAddictor fallback polling enabled");

      safeCaPolling();

      setInterval(safeCaPolling, 1000 * 60 * 6);
    }, 0);
  }

  if (process.env.ENABLE_CRICKTRACKER_NEWS_POLLING === "true") {
    setTimeout(() => {
      console.log("🧠 CricTracker fallback polling enabled");

      safeCtPolling();

      setInterval(safeCtPolling, 1000 * 60 * 6);
    }, 1000 * 60 * 10);
  }

  if (process.env.ENABLE_SPORTSKEEDA_NEWS_POLLING === "true") {
    setTimeout(() => {
      console.log("🧠 SPORTSKEEDA fallback polling enabled");

      setInterval(sportskeedaNewsPollingLoop, 1000 * 60 * 10);
    }, 0);
  }

  if (process.env.ENABLE_GEMINI_NEWS_POLLING === "true") {
    console.log("🧠 Gemini discovery polling enabled for crex-news");

    const MIN_DELAY = 5 * 60 * 1000; // 5 min
    const MAX_DELAY = 10 * 60 * 1000; // 15 min

    function randomDelay(min, max) {
      return min + Math.floor(Math.random() * (max - min));
    }

    async function scheduleGeminiPolling() {
      try {
        await googleNewsPollingLoop();
      } catch (err) {
        console.error("❌ Gemini polling error:", err?.message || err);
      }

      const nextDelay = randomDelay(MIN_DELAY, MAX_DELAY);
      console.log(
        `⏳ Next Gemini poll in ~${Math.round(nextDelay / 60000)} min`
      );

      setTimeout(scheduleGeminiPolling, nextDelay);
    }
    scheduleGeminiPolling();
  }
}

bootstrap();
