// autoReplyV5.js
import dotenv from "dotenv";
dotenv.config();

import { TwitterApi } from "twitter-api-v2";
import { generateSmartReply } from "./ai/replyGeneratorV2.js";
import accountIds from "./accountIds.json" with { type: "json" };

import {
  getRepliedTweets,
  saveRepliedTweets,
} from "./storage/repliedTweetsStore.js";

import {
  getAccountReplyCounts,
  saveAccountReplyCounts,
} from "./storage/accountReplyStore.js";

// ----------------------------------------
// CONFIG (Basic Plan Safe)
// ----------------------------------------
const MIN_CHARS = 120;
const MAX_REPLIES_PER_ACCOUNT = 2;
const MAX_AGE_MINUTES = 180; // reply only if tweet < 3 hours old

// 🔥 FINAL SAFE ACCOUNT LIST
const ACCOUNTS = [
  "vishalreacts",
  "criccrazyjohns",
  "cricketcomau",
  "mufaddal_vohra",
];

// Load IDs from JSON
let ACCOUNT_ID_MAP = accountIds;

const twitterClient = new TwitterApi({
  appKey: process.env.X_API_KEY,
  appSecret: process.env.X_API_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_SECRET,
});

const v2 = twitterClient.v2;

let repliedTweets = new Set();
let dailyCounts = {};
let lastResetDay = null;

const wait = (ms) => new Promise((res) => setTimeout(res, ms));
const nowTime = () =>
  new Date().toLocaleTimeString("en-US", { hour12: false });

// const user = await v2.userByUsername("CricCrazyJohns");
// console.log("user.data.id::::::",user.data.id);

// ----------------------------------------
// Daily Reset
// ----------------------------------------
function dailyResetIfNeeded() {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== lastResetDay) {
    dailyCounts = {};
    lastResetDay = today;
    console.log("🔄 Daily limits reset.");
  }
}



async function processAccount(username, userId) {
  try {
    dailyResetIfNeeded();

    // Fetch up to 10 entries so we can filter properly
    const timeline = await v2.userTimeline(userId, {
      max_results: 10,
      "tweet.fields": "created_at,referenced_tweets,in_reply_to_user_id"
    });

    // 🔍 DEBUG → PRINT RAW RESPONSE SO WE KNOW EXACT STRUCTURE
    console.log(`\n===== RAW TIMELINE for ${username} =====`);
    console.log(JSON.stringify(timeline.data, null, 2));
    console.log("=======================================\n");

    // Extract tweets list safely
    const entries = timeline?.data?.data || [];
    if (entries.length === 0) {
      console.log(`⛔ No timeline entries for ${username}`);
      return;
    }

    // 1️⃣ Identify ORIGINAL tweet (NOT reply, NOT RT, NOT quote)
    const originalTweet = entries.find(t =>
      !t.in_reply_to_user_id &&                // NOT a reply
      (!t.referenced_tweets || t.referenced_tweets.length === 0) // NOT RT or quote
    );

    if (!originalTweet) {
      console.log(`⛔ No original post found for ${username}`);
      return;
    }

    const tid = originalTweet.id;
    const text = originalTweet.text || "";

    // 2️⃣ AGE FILTER — keep only new tweets
    const createdAt = new Date(originalTweet.created_at).getTime();
    const ageMinutes = (Date.now() - createdAt) / (1000 * 60);

    const MAX_AGE_MINUTES = 180; // 3 hours
    if (ageMinutes > MAX_AGE_MINUTES) {
      console.log(
        `⛔ Skipping old tweet from ${username} (${Math.round(ageMinutes)} mins old)`
      );
      return;
    }

    // 3️⃣ Prevent duplicate replies
    if (repliedTweets.has(tid)) {
      console.log(`⏭ Already replied to ${tid}`);
      return;
    }

    // 4️⃣ Per-account daily limits
    const count = dailyCounts[username] || 0;
    if (count >= MAX_REPLIES_PER_ACCOUNT) {
      console.log(`⏳ Daily limit reached for ${username}`);
      return;
    }

    // 5️⃣ Skip short tweets
    if (text.length < MIN_CHARS) {
      console.log(`⛔ Skipping short tweet (${text.length} chars) from ${username}`);
      return;
    }

    console.log(`🧠 AI reply → ${username} ${tid}`);
    const aiReply = await generateSmartReply(text);

    if (!aiReply?.trim()) {
      console.log(`⛔ AI returned empty reply for ${username}`);
      return;
    }

    // 6️⃣ POST REPLY
    // await v2.reply(aiReply, tid);
    console.log(`💬 Replied to ${username}: ${aiReply}`);

    // 7️⃣ Save history
    repliedTweets.add(tid);
    await saveRepliedTweets([...repliedTweets]);

    dailyCounts[username] = count + 1;
    await saveAccountReplyCounts(dailyCounts);

  } catch (err) {
    if (err?.status === 429) {
      console.log("⏳ Rate limit hit → Pausing 2 minutes.");
      await new Promise((r) => setTimeout(r, 120000));
      return;
    }

    console.log("❌ Timeline fetch error:", err.data || err.message);
  }
}


// ----------------------------------------
// ROUND-ROBIN SCHEDULER (Basic-Safe)
// ----------------------------------------
let index = 0;

async function pollingLoop() {
  try {
    const usernames = Object.keys(ACCOUNT_ID_MAP);
    if (usernames.length === 0) {
      console.log("⚠ No accounts found, retrying in 60s");
      return setTimeout(pollingLoop, 60000);
    }

    const username = usernames[index];
    const userId = ACCOUNT_ID_MAP[username];

    console.log(`🔍 [${nowTime()}] Checking → ${username}`);

    await processAccount(username, userId);

    index = (index + 1) % usernames.length;

  } catch (err) {
    console.log("❌ Scheduler error:", err.message);
  }

  // ⏱️ Basic-plan safe interval: 3 minutes
  setTimeout(pollingLoop, 3 * 60 * 1000);
}

// ----------------------------------------
// BOOTSTRAP
// ----------------------------------------
async function boot() {
  console.log("🚀 AutoReplyV5 starting…");

  repliedTweets = new Set(await getRepliedTweets());
  dailyCounts = await getAccountReplyCounts();

  console.log("▶ Loaded state. Auto-reply LIVE (Basic-safe).");

  setTimeout(pollingLoop, 2000);
}

export async function startAutoReplyV5() {
  await boot();
}

if (process.argv[1].includes("autoReplyV5.js")) {
  boot();
}
