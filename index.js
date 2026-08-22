// index.js
import dotenv from "dotenv";
dotenv.config();

import { createLogger } from "./utils/logger.js";
import { loadState, saveState } from "./utils/stateStoreCloud.js";
import { cricbuzzNewsPollingLoop } from "./cricbuzz/cricbuzzNewsPollingLoop.js";
import { ieNewsPollingLoop } from "./indian-express/ieNewsPollingLoop.js";
import { tryFlushTweetQueue } from "./twitter/tweetQueue.js";
import { hinduNewsPollingLoop } from "./thehindu/hinduNewsPollingLoop.js";
import { ctNewsPollingLoop } from "./crictracker/ctNewsPollingLoop.js";
import { youtubeNewsPollingLoop } from "./youtube/ytNewsPollingLoop.js";
import { caNewsPollingLoop } from "./cricket-addictor/caNewsPollingLoop.js";
import { espnNewsPollingLoop } from "./espn-cricinfo/espnNewsPollingLoop.js";

import { ndtvNewspolling } from "./ndtv/ndtvNewspolling.js";
import { skNewsPollingLoop } from "./sportskeeda-cricket/skNewsPollingLoop.js";
import "./utils/fileLogger.js";
import { xNewsPollingLoop } from "./x-news-cricket/xNewsPollingLoop.js";

const log = createLogger("prod");

//https://app.scrappey.com/#/
global.STATE = null;
global.LAST_CA_SUCCESS_AT = 0;
global.CA_COOLDOWN_UNTIL = 0;

const SLEEP_WINDOW_START_HOUR = 1; // 1:00 AM IST
const SLEEP_WINDOW_END_HOUR = 5; // 5:00 AM IST

function getISTHour() {
  const istHourStr = new Date().toLocaleString("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    hour12: false,
  });
  return parseInt(istHourStr, 10) % 24;
}

function isSleepWindow() {
  const hour = getISTHour();
  return hour >= SLEEP_WINDOW_START_HOUR && hour < SLEEP_WINDOW_END_HOUR;
}

// Wraps a polling loop fn so setInterval calls this instead of the loop
// directly — every source gets the same gate, added in exactly one place.
function runIfAwake(pollFn, label) {
  return async () => {
    if (isSleepWindow()) {
      console.log(`😴 Sleep window (1-5 AM IST) — skipping ${label} poll`);
      return;
    }
    try {
      await pollFn();
    } catch (err) {
      console.error(`❌ ${label} poll error:`, err?.message || err);
    }
  };
}

async function bootstrap() {
  global.STATE = await loadState();

  setInterval(async () => {
    try {
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

  if (process.env.ENABLE_IE_NEWS_POLLING === "true") {
    console.log("📰 Indian Express news polling enabled");
    setInterval(runIfAwake(ieNewsPollingLoop, "Indian Express"), 1000 * 60 * 3);
  }

  if (process.env.ENABLE_HINDU_NEWS_POLLING === "true") {
    console.log("The Hindu news polling enabled");
    setInterval(runIfAwake(hinduNewsPollingLoop, "The Hindu"), 1000 * 60 * 2);
  }
  if (process.env.ENABLE_YOUTUBE_NEWS_POLLING === "true") {
    console.log("📺 YouTube transcript polling enabled");
    setInterval(runIfAwake(youtubeNewsPollingLoop, "YouTube"), 1000 * 60 * 15); // every 15 min
  }

  if (process.env.ENABLE_SPORTSKEEDA_NEWS_POLLING === "true") {
    console.log("The sportskeeda news polling enabled");
    setInterval(runIfAwake(skNewsPollingLoop, "SportsKeeda"), 1000 * 60 * 5);
  }

  if (process.env.ENABLE_XNEWS_NEWS_POLLING === "true") {
    console.log("The xNewsPollingLoop news polling enabled");
    setInterval(runIfAwake(xNewsPollingLoop, "X News"), 1000 * 60 * 15);
  }

  if (process.env.ENABLE_CRICKTRACKER_NEWS_POLLING === "true") {
    console.log("The Crictracker news polling enabled");
    setInterval(runIfAwake(ctNewsPollingLoop, "CricTracker"), 1000 * 60 * 3);
  }

  if (process.env.ENABLE_ESPN_NEWS_POLLING === "true") {
    console.log("The ESPN news polling enabled");
    setInterval(
      runIfAwake(espnNewsPollingLoop, "ESPN Cricinfo"),
      1000 * 60 * 4,
    );
  }

  if (process.env.ENABLE_NDTV_NEWS_POLLING === "true") {
    console.log("📰 Ndtv news polling is enabled");
    setInterval(runIfAwake(ndtvNewspolling, "NDTV"), 1000 * 60 * 3);
  }

  if (process.env.ENABLE_CRICKETADDICTOR_NEWS_POLLING === "true") {
    console.log("📰 Cricket Addictor news polling is enabled");
    setInterval(
      runIfAwake(caNewsPollingLoop, "CricketAddictor"),
      1000 * 60 * 3,
    );
  }

  if (process.env.ENABLE_CRICBUZZ_NEWS_POLLING === "true") {
    console.log("📰 Cricbuzz news polling is enabled");
    setInterval(
      runIfAwake(cricbuzzNewsPollingLoop, "Cricbuzz"),
      1000 * 60 * 15,
    );
  }
}

bootstrap();
