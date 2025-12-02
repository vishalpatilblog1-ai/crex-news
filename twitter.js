// twitter.js
import { TwitterApi } from "twitter-api-v2";
import dotenv from "dotenv";
import { createLogger } from "./utils/logger.js";

dotenv.config();
const log = createLogger("prod");

const twitterClient = new TwitterApi({
  appKey: process.env.X_API_KEY,
  appSecret: process.env.X_API_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_SECRET,
});

export async function postTweet_console(text) {
  if (typeof text !== "string") {
    log("❌ Invalid tweet (not a string)");
    console.log("INVALID TWEET:", text);
    return;
  }

  if (!text.trim()) {
    log("⚠ Empty tweet skipped (console mode)");
    return;
  }

  console.log("=============================");
  console.log("🟦 AI PROD TWEET (CONSOLE MODE):");
  console.log(text);
  console.log("=============================");

  return { status: "console_ok", text };
}

export async function postTweet_web(text) {
  try {
    if (typeof text !== "string") {
      log("❌ Invalid tweet (not a string)");
      console.log("INVALID TWEET:", text);
      return;
    }

    if (!text.trim()) {
      log("⚠ Empty tweet skipped (console mode)");
      return;
    }

    const res = await twitterClient.v2.tweet(text);
    log("📤 Tweet POSTED via API:");
    log(JSON.stringify(res.data, null, 2));

    console.log("📤 Tweet POSTED via API:");
    console.log(JSON.stringify(res.data, null, 2));

    return res.data;
  } catch (err) {
    log("❌ Error posting tweet (API):");
    log(err);
  }
}
