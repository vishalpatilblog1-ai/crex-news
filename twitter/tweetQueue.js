// twitter/tweetQueue.js

import { saveState } from "../utils/stateStoreCloud.js";
import { tweetNewsWithImage, tweetNewsWithoutImage } from "./twitter.js";

global.NEXT_TWEET_ALLOWED_AT ??= 0;

const CONSOLE_ONLY = process.env.CONSOLE_ONLY === "true";
const MAX_TWEET_AGE_MS = 60 * 60 * 1000; // don't post news older than 60 min

// Don't post two tweets about the same person within this window -- lets a
// strong 2nd/3rd angle on the same subject (e.g. two Anil Chaudhary angles
// from one interview) still go out, just spaced apart instead of back-to-back
// in a follower's scroll. Skip-ahead, not suppression -- nothing is dropped.
const SAME_SUBJECT_COOLDOWN_MS = 3 * 60 * 60 * 1000; // 3h

// HARD SAFETY VALVE: spacing must never become a full stoppage. If nothing
// in the queue has been eligible for this long, the oldest tweet posts
// anyway, cooldown or not. This is what was missing before -- without it,
// a false-positive "subject" match (see extractSubjectKey below) could
// block the entire queue indefinitely, which is exactly what happened.
const MAX_WAIT_BEFORE_OVERRIDE_MS = 20 * 60 * 1000; // 20 min

// Generic cricket terms that are NOT a specific person -- extractSubjectKey
// would otherwise match these as if they were a "Firstname Lastname" name,
// since they're two capitalized words too. This was the root cause of the
// full-queue lockup: nearly every tweet mentions one of these, so they all
// ended up sharing a "subject" and blocking each other.
const GENERIC_TERM_BLOCKLIST = new Set([
  "World Cup",
  "Test Series",
  "Test Match",
  "T20 World",
  "T20I Series",
  "ODI Series",
  "ODI World",
  "Sri Lanka",
  "South Africa",
  "New Zealand",
  "West Indies",
  "Team India",
  "IPL 2026",
  "IPL 2027",
  "Asian Games",
  "Cricket Australia",
  "Chief Selector",
  "Head Coach",
  "Board Of",
]);

function randomTweetDelay(source) {
  const MIN = 2 * 60 * 1000;
  const MAX = 4 * 60 * 1000;

  return MIN + Math.random() * (MAX - MIN);
}

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

function extractSubjectKey(text) {
  if (!text) return null;
  const matches = text.matchAll(/\b([A-Z][a-zA-Z'-]+ [A-Z][a-zA-Z'-]+)\b/g);
  for (const m of matches) {
    if (!GENERIC_TERM_BLOCKLIST.has(m[1])) return m[1];
  }
  return null;
}

function isSubjectOnCooldown(STATE, subjectKey) {
  if (!subjectKey) return false;
  const lastAt = STATE.lastPostedBySubject?.[subjectKey];
  if (!lastAt) return false;
  return Date.now() - lastAt < SAME_SUBJECT_COOLDOWN_MS;
}

function pickNextEligibleIndex(STATE) {
  for (let i = 0; i < STATE.tweetQueue.length; i++) {
    if (!isSubjectOnCooldown(STATE, STATE.tweetQueue[i].subjectKey)) return i;
  }
  return -1;
}

export function enqueueTweet({
  id,
  source,
  text,
  imageUrl,
  seenKey,
  publishedAt,
  subjectKey,
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
    subjectKey: subjectKey ?? extractSubjectKey(text),
    publishedAt: publishedAt ?? Date.now(), // real article pubDate, kept for reference/debugging -- no longer used for the staleness check itself
    createdAt: Date.now(),
  });

  console.log(`📥 Queued tweet from ${source}: ${id}`);
}

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

  let index = pickNextEligibleIndex(STATE);

  if (index === -1) {
    const head = STATE.tweetQueue[0];
    const waitedMs = Date.now() - (head.createdAt ?? Date.now());

    if (waitedMs >= MAX_WAIT_BEFORE_OVERRIDE_MS) {
      console.log(
        `⚠️ Oldest queued tweet has waited ${Math.round(waitedMs / 60000)}m on subject cooldown — overriding and posting it anyway.`,
      );
      index = 0;
    } else {
      console.log(
        "⏳ Every queued tweet shares a subject posted within the last 3h — waiting for cooldown.",
      );
      return false;
    }
  }

  const next = STATE.tweetQueue[index];

  if (!canTweetNow(next.source)) return false;

  STATE.tweetQueue.splice(index, 1);

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

    if (next.subjectKey) {
      STATE.lastPostedBySubject ??= {};
      STATE.lastPostedBySubject[next.subjectKey] = Date.now();
    }

    markTweeted("QUEUE", next.source);
    await saveState(STATE);

    console.log(`🚀 Flushed queued tweet: ${next.id}`);
    return true;
  } catch (err) {
    console.error("❌ Queue tweet failed, requeueing:", err);

    STATE.tweetQueue.splice(index, 0, next); // put it back at its original spot, not just the front
    await saveState(STATE);
    return false;
  }
}

export function applySourceSignature(text, source) {
  const signatureMap = {
    CT: ".",
    CB: ".",
    IE: "_",
    CA: ".",
    YT: " !",
  };

  const signature = signatureMap[source] || ".";
  return text.replace(/[.!]+$/, "") + signature;
}
