// twitter/tweetQueue.js

import { saveState } from "../utils/stateStoreCloud.js";
import { tweetNewsWithImage, tweetNewsWithoutImage } from "./twitter.js";

global.NEXT_TWEET_ALLOWED_AT ??= 0;

const USE_WEB_TWEET = process.env.USE_WEB_TWEET === "true";

const MAX_TWEET_AGE_MS = 60 * 60 * 1000; // don't post news older than 60 min

function randomTweetDelay(source) {
  const MIN = 2 * 60 * 1000;
  const MAX = 4 * 60 * 1000;

  return MIN + Math.random() * (MAX - MIN);
}

// NOTE: the CA-specific 11:30PM-6AM block and the general 1-5AM
// isQuietHoursBlocked check that used to live here have been removed.
// index.js now applies a single global sleep window (1-5 AM IST, via
// runIfAwake) at the polling level for every source, including CA — so
// gating it again here was redundant, and CA's window no longer matching
// the global one was actively conflicting. If caNewsPollingLoop.js still
// imports isCricketAddictorBlocked from this file, that import needs to be
// removed there too or the build will break.

function canTweetNow(source) {
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
    if (!USE_WEB_TWEET) {
      console.log("🧪 USE_WEB_TWEET=false — tweet skipped (console only)");
      console.log({
        source: next.source,
        text: next.text,
        imageUrl: next.imageUrl,
      });

      markTweeted("USE_WEB_TWEET=false", next.source);
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
    CB: ".",
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
