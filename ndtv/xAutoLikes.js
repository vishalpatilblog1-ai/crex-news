//node ndtv/xAutoLikes.js

import { TwitterApi } from "twitter-api-v2";
import dotenv from "dotenv";
dotenv.config();

const client = new TwitterApi({
  appKey: process.env.X_API_KEY,
  appSecret: process.env.X_API_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_SECRET,
}).readWrite;

// Random delay helper
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const randomDelay = () => Math.floor(Math.random() * 2000) + 3000; // 3000-5000ms

// const usernames = [
//   "Sportybuzz1",
//   "urstrulyjaat19",
//   "Snarky_Sorcerer",
//   "AnupPalAgt",
//   "InfinitySPx",
//   "abhishek7585932",
//   "Unfiltered_c",
//   "Cricketmythos",
//   "Sanjeeb2412",
//   "Vipintiwari952",
// ];

const usernames = [
  "navshar54008403",
  "bagga_buntyy",
  "ClassicKohlii",
  "cric__star",
  "NotJustARutuFan",
  "abhinav_msdian7",
  "Mahi_Patel_07",
  "avbvikash1810",
  "Krishna68450405",
  "spideynation_",
  "IS_Netwrk29",
  "Kane_20_",
  "Out_2Box",
  "SumitFotography",
  "Vikas662005",
  "bagga_buntyy",
  "Cricketmythos",
  "MSDianMrigu",
  "Aware_Indian7",
  "Rolexsir31",
];

// const usernames = ["PaceandPlans"];

const me = await client.v2.userByUsername("gullypoint_");

for (const username of usernames) {
  try {
    console.log(`\n📌 Processing @${username}`);

    const target = await client.v2.userByUsername(username);

    const tweets = await client.v2.userTimeline(target.data.id, {
      max_results: 5,
      exclude: ["replies", "retweets"],
    });

    if (!tweets.data?.data?.length) {
      console.log("No tweets found.");
      continue;
    }

    for (const tweet of tweets.data.data) {
      const delay = randomDelay();

      console.log(`⏳ Waiting ${delay / 1000}s...`);
      await sleep(delay);

      await client.v2.like(me.data.id, tweet.id);
      // console.log(`❤️ Liked ${tweet.id}`);
    }
  } catch (err) {
    console.error(`❌ Failed for @${username}:`, err.message);
  }
}

console.log("\n✅ Done!");
