// twitter/tweetQueue.js

import { saveState } from "../utils/stateStoreCloud.js";
import { tweetNewsWithImage } from "./tweetNewsWithImage.js";
import { postTweet_ie_web } from "./twitter.js";

/**
 * Global timing controls
 * These survive across polling cycles
 */
global.NEXT_TWEET_ALLOWED_AT ??= 0;

/**
 * Tweet delay window (human-like)
 */
const MIN_TWEET_DELAY = 5 * 60 * 1000; // 5 minutes
const MAX_TWEET_DELAY = 10 * 60 * 1000; // 10 minutes

/**
 * Console-only mode (no real posting)
 */
const CONSOLE_ONLY = process.env.CONSOLE_ONLY === "true";

/**
 * Generate random delay between MIN and MAX
 */
function randomTweetDelay() {
  return (
    MIN_TWEET_DELAY +
    Math.floor(Math.random() * (MAX_TWEET_DELAY - MIN_TWEET_DELAY))
  );
}

// function canTweetNow(source) {
//   const now = Date.now();
//   const nextAllowed = global.NEXT_TWEET_ALLOWED_AT || 0;

//   if (now < nextAllowed) {
//     console.log(
//       `⏳ Tweet cooldown (${Math.ceil(
//         (nextAllowed - now) / 1000
//       )}s left) — ${source} skipped`
//     );
//     return false;
//   }

//   return true;
// }

function canTweetNow(source) {
  if (isSleepWindow() && !global.LIVE_MATCH_ACTIVE) {
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

// function isSleepWindow() {
//   const now = new Date();

//   const istTime = new Date(
//     now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
//   );

//   const hour = istTime.getHours();

//   return hour >= 1 && hour < 6;
// }

function isSleepWindow() {
  console.log("🕒 IST hour:", hour, "minute:", minute);
  const now = new Date();

  const istTime = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );

  const hour = istTime.getHours();
  const minute = istTime.getMinutes();

  // TEST WINDOW: 11:05 PM – 11:10 PM IST
  return hour === 23 && minute >= 10 && minute < 15;
}

function markTweeted(source) {
  const delay = randomTweetDelay();

  global.LAST_TWEET_AT = Date.now();
  global.NEXT_TWEET_ALLOWED_AT = Date.now() + delay;

  console.log(
    `🟢 Tweet sent by ${source}. Next tweet in ~${Math.round(
      delay / 60000
    )} min`
  );
}

/**
 * Add tweet to queue (id-deduped)
 */
export function enqueueTweet({ id, source, text, imageUrl }) {
  const STATE = global.STATE;
  if (!STATE.tweetQueue) STATE.tweetQueue = [];

  // Prevent duplicate queueing
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
  if (!canTweetNow("QUEUE")) return false;

  const next = STATE.tweetQueue.shift();

  try {
    if (CONSOLE_ONLY) {
      console.log("🧪 CONSOLE_ONLY — tweet skipped");
      console.log({
        source: next.source,
        text: next.text,
        imageUrl: next.imageUrl,
      });

      markTweeted("CONSOLE_ONLY");
      await saveState(STATE);
      return true;
    }

    if (next.imageUrl) {
      await tweetNewsWithImage(next.text, next.imageUrl);
    } else {
      await postTweet_ie_web({ text: next.text });
    }

    markTweeted("QUEUE");
    await saveState(STATE);

    console.log(`🚀 Flushed queued tweet: ${next.id}`);
    return true;
  } catch (err) {
    console.error("❌ Queue tweet failed, requeueing:", err);

    // Put tweet back at the front
    STATE.tweetQueue.unshift(next);
    await saveState(STATE);
    return false;
  }
}

/**
 * Append punctuation-based source signature
 */
export function applySourceSignature(text, source) {
  const signatureMap = {
    // CA: ".",
    CT: ".",
    CB: ".",
    IE: "_",
    // GN: "..",
    // SK: "_",
  };

  const signature = signatureMap[source] || ".";
  return text.replace(/[.!]+$/, "") + signature;
}
