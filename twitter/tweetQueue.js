// twitter/tweetQueue.js

import { saveState } from "../utils/stateStoreCloud.js";
import { tweetNewsWithImage, tweetNewsWithoutImage } from "./twitter.js";

global.NEXT_TWEET_ALLOWED_AT ??= 0;

const CONSOLE_ONLY = process.env.CONSOLE_ONLY === "true";
const MAX_TWEET_AGE_MS = 60 * 60 * 1000; // don't post news older than 60 min

function randomTweetDelay(source) {
  const MIN = 2 * 60 * 1000;
  const MAX = 4 * 60 * 1000;

  return MIN + Math.random() * (MAX - MIN);
}

// Blocks CricketAddictor polling + tweeting from 11:30 PM to 6:00 AM IST.
// Exported so caNewsPollingLoop can also skip fetching/queueing during this window.
export function isCricketAddictorBlocked(source) {
  if (source !== "CA") return false;

  const now = new Date();

  const istTime = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
  );

  const hour = istTime.getHours();
  const minutes = istTime.getMinutes();

  // Block from 23:30 to 06:00
  if (hour > 23 || hour < 6) return true;
  if (hour === 23 && minutes >= 30) return true;

  return false;
}

export function isQuietHoursBlocked(source) {
  if (source === "CA") return false;

  const now = new Date();

  const istTime = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
  );

  const hour = istTime.getHours();

  return hour >= 1 && hour < 5;
}

function canTweetNow(source) {
  if (isCricketAddictorBlocked(source)) {
    console.log("🚫 CA blocked (11:30 PM – 6 AM window)");
    return false;
  }

  const now = Date.now();
  const nextAllowed = global.NEXT_TWEET_ALLOWED_AT || 0;

  if (now < nextAllowed) {
    console.log(
      `⏳ Tweet cooldown (${Math.ceil(
        (nextAllowed - now) / 1000,
      )}s left) — ${source} skipped`,
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
    `🟢 Tweet sent by ${trigger} (source: ${source}). Next tweet in ~${seconds}s`,
  );
}

export function enqueueTweet({
  id,
  source,
  text,
  imageUrl,
  seenKey,
  publishedAt,
}) {
  const STATE = global.STATE;
  if (!STATE.tweetQueue) STATE.tweetQueue = [];

  if (STATE.tweetQueue.some((t) => t.id === id)) return;

  STATE.tweetQueue.push({
    id,
    source,
    text,
    imageUrl,
    seenKey,
    publishedAt: publishedAt ?? Date.now(), // real article pubDate, used for the 60-min freshness check at flush time
    createdAt: Date.now(),
  });

  console.log(`📥 Queued tweet from ${source}: ${id}`);
}

// Removes anything sitting in the queue that's now older than MAX_TWEET_AGE_MS.
// Prevents stale news from firing once a blocked window lifts (e.g. overnight backlog).
function dropStaleQueuedTweets(STATE) {
  let droppedAny = false;

  while (STATE.tweetQueue.length) {
    const head = STATE.tweetQueue[0];
    const age = Date.now() - head.createdAt;

    if (age <= MAX_TWEET_AGE_MS) break;

    console.log(
      `🗑️ Dropping stale queued tweet (${Math.round(age / 60000)}m old): ${head.id}`,
    );
    STATE.tweetQueue.shift();
    droppedAny = true;
  }

  return droppedAny;
}

export async function tryFlushTweetQueue() {
  const STATE = global.STATE;

  if (!STATE?.tweetQueue?.length) return false;

  const droppedStale = dropStaleQueuedTweets(STATE);
  if (droppedStale) await saveState(STATE, "dropped stale queued tweets");

  if (!STATE.tweetQueue.length) return false;

  // Plain FIFO now -- subject-based cooldown/spacing removed. Real
  // duplicate-story protection is handled elsewhere already
  // (judgeNewsContext's isAlreadyCovered check, which looks at actual
  // content) and isBlockedSKHeadline (content-type filtering) -- this queue
  // just posts what's next.
  const next = STATE.tweetQueue[0];

  if (!canTweetNow(next.source)) return false;

  STATE.tweetQueue.shift();

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
        next.source,
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

    STATE.tweetQueue.unshift(next); // put it back at the front, it never posted
    await saveState(STATE);
    return false;
  }
}

export function applySourceSignature(text, source) {
  const signatureMap = {
    CB: "_",
    SK: ".",
    XN: "!.",
    CT: ".",
    IE: "_",
    CA: ".",
    YT: " !",
  };

  const signature = signatureMap[source] || ".";
  return text.replace(/[.!]+$/, "") + signature;
}
