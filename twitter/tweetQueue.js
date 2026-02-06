// twitter/tweetQueue.js

import { tweetNewsWithImage } from "./tweetNewsWithImage.js";
import { saveState } from "../utils/stateStoreCloud.js";

const GLOBAL_TWEET_COOLDOWN_MS = 60 * 1000; // 1 minute

function canTweetNow(source) {
  const now = Date.now();
  const diff = now - (global.LAST_TWEET_AT || 0);

  if (diff < GLOBAL_TWEET_COOLDOWN_MS) {
    console.log(
      `⏳ Global tweet cooldown (${Math.ceil(
        (GLOBAL_TWEET_COOLDOWN_MS - diff) / 1000
      )}s left) — ${source} skipped`
    );
    return false;
  }

  return true;
}

function markTweeted(source) {
  global.LAST_TWEET_AT = Date.now();
  console.log(`🟢 Global tweet lock acquired by ${source}`);
}

/* -------------------------------------------------
   Queue Operations (JSONBin-backed)
-------------------------------------------------- */

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
  if (!canTweetNow("QUEUE")) return false;

  const next = STATE.tweetQueue.shift();

  try {
    await tweetNewsWithImage(next.text, next.imageUrl);
    markTweeted("QUEUE");

    // 🔑 Source already marked as seen BEFORE enqueue
    await saveState(STATE);

    console.log(`🚀 Flushed queued tweet: ${next.id}`);
    return true;
  } catch (err) {
    console.error("❌ Queue tweet failed, requeueing:", err);

    // Put it back at the front
    STATE.tweetQueue.unshift(next);
    await saveState(STATE);
    return false;
  }
}

export function applySourceSignature(text, source) {
  const signatureMap = {
    CA: ".",
    CT: "!",
    CB: "!.",
  };

  return text.replace(/[.!]+$/, "") + signatureMap[source];
}
