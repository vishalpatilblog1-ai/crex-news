// autoReplyV5.js
import dotenv from "dotenv";
dotenv.config();

import { TwitterApi } from "twitter-api-v2";
import { generateSmartReply } from "./ai/replyGeneratorV2.js";

import {
  getRepliedTweets,
  saveRepliedTweets,
} from "./storage/repliedTweetsStore.js";

import {
  getAccountReplyCounts,
  saveAccountReplyCounts,
} from "./storage/accountReplyStore.js";

// ----------------------------
// CONFIG
// ----------------------------
const MIN_CHARS = 120;
const MAX_REPLIES_PER_ACCOUNT = 2;

const ACCOUNTS = [
  "vishalreacts",
  "criccrazyjohns",
  "cricketcomau",
  "mufaddal_vohra",
  "thebarmyarmy",

  // SECONDARY
  // "icc",
  // "thebarmyarmy",
  // "cricbuzz",
  // "blackcaps",
  // "windiescricket",
];

// Twitter Client
const twitterClient = new TwitterApi({
  appKey: process.env.X_API_KEY,
  appSecret: process.env.X_API_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_SECRET,
});

const v2 = twitterClient.v2;

// Memory stores
let ACCOUNT_ID_MAP = {};
let repliedTweets = new Set();
let dailyCounts = {};
let lastResetDay = null;

const wait = (ms) => new Promise((res) => setTimeout(res, ms));

function nowTime() {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

function dailyResetIfNeeded() {
  const now = new Date().toISOString().slice(0, 10);

  if (lastResetDay !== now) {
    dailyCounts = {};
    lastResetDay = now;
    console.log("🔄 Daily reset done.");
  }
}

async function resolveUserIds() {
  console.log("🔍 Resolving user IDs...");

  for (const username of ACCOUNTS) {
    try {
      const u = await v2.userByUsername(username);

      if (!u?.data?.id) {
        console.log(`❌ Could not resolve ${username}`);
      } else {
        ACCOUNT_ID_MAP[username] = u.data.id;
        console.log(`✔ ${username} → ${u.data.id}`);
      }
    } catch (e) {
      console.log(`❌ Failed to resolve ${username}:`, e.data || e.message);
    }

    // ⏳ Wait 15 seconds before hitting next API
    console.log(`⏳ Waiting 15s before next lookup...`);
    await wait(10000);
  }

  // for (const username of ACCOUNTS) {
  //   try {
  //     const u = await v2.userByUsername(username);

  //     if (!u?.data?.id) {
  //       console.log(`❌ Could not resolve ${username}`);
  //       continue;
  //     }

  //     ACCOUNT_ID_MAP[username] = u.data.id;
  //     console.log(`✔ ${username} → ${u.data.id}`);
  //   } catch (e) {
  //     console.log(`❌ Failed to resolve ${username}:`, e.data || e.message);
  //   }
  // }

  console.log("➡ Final ACCOUNT_ID_MAP:", ACCOUNT_ID_MAP);
}

async function processAccount(username, userId) {
  try {
    dailyResetIfNeeded();

    const timeline = await v2.userTimeline(userId, { max_results: 5 });

    if (!timeline?.data?.data?.length) return;

    const tweet = timeline.data.data[0]; // 🔥 Only latest tweet
    const tid = tweet.id;
    const text = tweet.text || "";

    if (repliedTweets.has(tid)) return;

    const count = dailyCounts[username] || 0;
    if (count >= MAX_REPLIES_PER_ACCOUNT) return;

    if (text.length < MIN_CHARS) return;

    console.log(`🧠 AI reply → ${username} ${tid}`);

    const aiReply = await generateSmartReply(text);
    if (!aiReply?.trim()) return;

    // Actually post reply
    await v2.reply(aiReply, tid);

    console.log(`💬 Replied to ${username}: ${aiReply}`);

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

let rrIndex = 0;

async function pollingLoop() {
  try {
    const usernames = Object.keys(ACCOUNT_ID_MAP);

    if (usernames.length === 0) {
      console.log("⚠ No accounts found, retry in 60s");
      return setTimeout(pollingLoop, 60000);
    }

    const username = usernames[rrIndex];
    const userId = ACCOUNT_ID_MAP[username];

    // console.log(`🔍 Checking timeline → ${username}`);
    console.log(`🔍 [${nowTime()}] Checking timeline → ${username}`);

    await processAccount(username, userId);

    rrIndex = (rrIndex + 1) % usernames.length;
  } catch (e) {
    console.log("❌ Loop error:", e.message || e);
  }

  // ALWAYS wait 60s — respects rate limit
  setTimeout(pollingLoop, 60000);
}

async function boot() {
  console.log("🚀 AutoReplyV5 (safe mode) starting...");

  repliedTweets = new Set(await getRepliedTweets());
  dailyCounts = await getAccountReplyCounts();

  await resolveUserIds();

  console.log("▶ Service is LIVE with 1 GET/min polling (SAFE).");

  // start after 2 seconds
  setTimeout(pollingLoop, 2000);
}

export async function startAutoReplyV5() {
  await boot();
}

if (process.argv[1].includes("autoReplyV5.js")) {
  boot();
}
