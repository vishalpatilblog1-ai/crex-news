// twitter/tweetQueue.js

import { generateNewsReplyTweet } from "../ai/generateNewsReplyTweet.js";
import { saveState } from "../utils/stateStoreCloud.js";
// import { tweetNewsWithImage } from "./tweetNewsWithImage.js";
import { tweetNewsWithImage, tweetNewsWithoutImage } from "./twitter.js";

/**
 * Global timing controls
 * These survive across polling cycles
 */
global.NEXT_TWEET_ALLOWED_AT ??= 0;

const MIN_TWEET_DELAY = 5 * 60 * 1000;
const MAX_TWEET_DELAY = 10 * 60 * 1000;

const CONSOLE_ONLY = process.env.CONSOLE_ONLY === "true";

function randomTweetDelay() {
  return (
    MIN_TWEET_DELAY +
    Math.floor(Math.random() * (MAX_TWEET_DELAY - MIN_TWEET_DELAY))
  );
}

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

function isSleepWindow() {
  const now = new Date();

  const istTime = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );

  const hour = istTime.getHours();
  console.log("🕒 IST hour:", hour);

  return hour >= 1 && hour < 6;
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
export function enqueueTweet({ id, source, text, imageUrl, articleBody }) {
  const STATE = global.STATE;
  if (!STATE.tweetQueue) STATE.tweetQueue = [];

  if (STATE.tweetQueue.some((t) => t.id === id)) return;

  STATE.tweetQueue.push({
    id,
    source,
    text,
    imageUrl,
    // _articleBody: articleBody,
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

    // if (next.imageUrl) {
    //   await tweetNewsWithImage(next.text, next.imageUrl);
    // } else {
    //   await postTweet_ie_web({ text: next.text });
    // }

    let tweetResponse;

    if (next.imageUrl) {
      tweetResponse = await tweetNewsWithImage(next.text, next.imageUrl);
    } else {
      tweetResponse = await tweetNewsWithoutImage({ text: next.text });
    }

    // console.log("next:::::", next);
    console.log("tweetResponse:::::", next.text);
    const tweetId = tweetResponse?.data?.id;

    console.log("tweetId:::", tweetId, "source::", next.source);

    if (tweetId && next.source == "CB") {
      console.log("started ...");
      setTimeout(async () => {
        try {
          const replyText = await generateNewsReplyTweet(next.text);

          if (!replyText) return;

          await tweetNewsWithoutImage({
            text: replyText,
            replyTo: tweetId,
          });

          console.log(`↪️ ${next.source} reply posted::: ${replyText}`);
        } catch (err) {
          console.error("❌ IE reply failed:", err);
        }
      }, 25000);
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
