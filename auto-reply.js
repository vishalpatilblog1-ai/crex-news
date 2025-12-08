import dotenv from "dotenv";
import { TwitterApi } from "twitter-api-v2";
import { generateReplyFromAI } from "./auto-reply/ai/replyGenerator";
dotenv.config();

// import { TwitterApi } from "twitter-api-v2";
// import { generateReplyFromAI } from "./ai/replyGenerator.js";

const twitterClient = new TwitterApi({
  appKey: process.env.X_API_KEY,
  appSecret: process.env.X_API_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_SECRET,
});

const client = twitterClient.readWrite;

async function testOnce() {
  try {
    console.log("🚀 Running one-time auto-reply test...\n");

    const username = "cricketcomau"; // change if needed

    // 1️⃣ Get the user ID
    const user = await client.v2.userByUsername(username);
    const userId = user.data.id;

    // 2️⃣ Get the latest tweet
    const tl = await client.v2.userTimeline(userId, {
      max_results: 5,
      exclude: "replies",
    });

    const latest = tl.data?.data?.[0];
    if (!latest) {
      console.log("❌ No tweets found for", username);
      return;
    }

    console.log("🆕 Latest Tweet:");
    console.log(latest.text, "\n");

    const replyText = await generateReplyFromAI(latest.text);

    console.log("🤖 AI Reply Prepared:");
    console.log(replyText, "\n");

    // const response = await client.v2.tweet({
    //   text: replyText,
    //   reply: { in_reply_to_tweet_id: latest.id },
    // });

    console.log("✅ Reply posted:", response.data);
    console.log("\n🎉 Test completed successfully.");
  } catch (err) {
    console.error("❌ Error in test:", err?.data || err.message);
  }
}

testOnce();
