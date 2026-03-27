// twitter/tweetQueue.js

import { saveState } from "../utils/stateStoreCloud.js";
import { tweetNewsWithImage, tweetNewsWithoutImage } from "./twitter.js";

global.NEXT_TWEET_ALLOWED_AT ??= 0;

const CONSOLE_ONLY = process.env.CONSOLE_ONLY === "true";

function randomTweetDelay(source) {
  if (["NDTV", "CT", "CB", "ESPN"].includes(source)) {
    const MIN = 60 * 1000;
    const MAX = 2 * 60 * 1000;
    return MIN + Math.random() * (MAX - MIN);
  }

  const MIN = 2 * 60 * 1000;
  const MAX = 5 * 60 * 1000;

  return MIN + Math.random() * (MAX - MIN);
}

function isSleepWindow() {
  const now = new Date();

  const istTime = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );

  const hour = istTime.getHours();
  console.log("🕒 IST hour:", hour);

  return hour >= 1 && hour < 6;
}

function isCricketAddictorBlocked(source) {
  if (source !== "CA") return false;

  const now = new Date();

  const istTime = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );

  const hour = istTime.getHours();

  return hour >= 22 || hour < 6;
}

function canTweetNow(source) {
  if (isCricketAddictorBlocked(source)) {
    console.log("🚫 CA blocked (10 PM – 6 AM window)");
    return false;
  }

  if (isSleepWindow()) {
    console.log("🌙 Sleep window active — queue paused");
    return false;
  }

  const now = Date.now();
  const nextAllowed = global.NEXT_TWEET_ALLOWED_AT || 0;

  if (now < nextAllowed) {
    console.log(
      `⏳ Tweet cooldown (${Math.ceil(
        (nextAllowed - now) / 1000
      )}s left) — ${source} skipped`
    );
    return false;
  }

  return true;
}

function markTweeted(trigger, source) {
  const delay = randomTweetDelay(source);

  global.LAST_TWEET_AT = Date.now();
  global.NEXT_TWEET_ALLOWED_AT = Date.now() + delay;

  const seconds = Math.round(delay / 1000);

  console.log(
    `🟢 Tweet sent by ${trigger} (source: ${source}). Next tweet in ~${seconds}s`
  );
}

export function enqueueTweet({ id, source, text, imageUrl }) {
  const STATE = global.STATE;
  if (!STATE.tweetQueue) STATE.tweetQueue = [];

  if (STATE.tweetQueue.some((t) => t.id === id)) return;

  STATE.tweetQueue.push({
    id,
    source,
    text,
    imageUrl,
    createdAt: Date.now(),
  });

  console.log(`📥 Queued tweet from ${source}: ${id}`);
}

export async function tryFlushTweetQueue() {
  const STATE = global.STATE;

  if (!STATE?.tweetQueue?.length) return false;

  const next = STATE.tweetQueue[0]; // 👈 peek first

  if (!canTweetNow(next.source)) return false;

  STATE.tweetQueue.shift(); // 👈 now remove

  try {
    if (CONSOLE_ONLY) {
      console.log("🧪 CONSOLE_ONLY — tweet skipped");
      console.log({
        source: next.source,
        text: next.text,
        imageUrl: next.imageUrl,
      });

      markTweeted("CONSOLE_ONLY", next.source);
      await saveState(STATE);
      return true;
    }

    let tweetResponse;

    if (next.imageUrl) {
      tweetResponse = await tweetNewsWithImage(
        next.text,
        next.imageUrl,
        next.source
      );
    } else {
      tweetResponse = await tweetNewsWithoutImage({ text: next.text });
    }

    markTweeted("QUEUE", next.source);
    await saveState(STATE);

    console.log(`🚀 Flushed queued tweet: ${next.id}`);
    return true;
  } catch (err) {
    console.error("❌ Queue tweet failed, requeueing:", err);

    STATE.tweetQueue.unshift(next);
    await saveState(STATE);
    return false;
  }
}

export function applySourceSignature(text, source) {
  const signatureMap = {
    CT: ".",
    CB: ".",
    IE: "_",
  };

  const signature = signatureMap[source] || ".";
  return text.replace(/[.!]+$/, "") + signature;
}
