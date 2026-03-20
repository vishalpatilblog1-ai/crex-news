// quoteVideoTweet.js

import { twitterClient } from "../twitter/twitter.js";

const CONSOLE_ONLY = process.env.CONSOLE_ONLY === "true";

export async function quoteVideoTweet({ tweetId, text }) {
  if (CONSOLE_ONLY) {
    console.log("\n🧪 [CONSOLE MODE]");
    console.log("Tweet Text:\n", text);
    console.log("Quote Tweet ID:", tweetId);
    console.log("👉 https://twitter.com/i/web/status/" + tweetId);
    return;
  }

  const client = twitterClient.readWrite;

  try {
    const res = await client.v2.tweet({
      text,
      quote_tweet_id: tweetId,
    });

    console.log("✅ Quote tweet success:", tweetId);
    return res;
  } catch (err) {
    console.log(
      "⚠️ Quote failed → fallback:",
      err?.data?.detail || err.message
    );

    const fallbackRes = await client.v2.tweet({
      //   text: `${text}\n\nhttps://x.com/i/web/status/${tweetId}`,
      text: `${text} !! https://twitter.com/imVkohli/status/${tweetId}`,
    });

    console.log("✅ Fallback tweet posted:", tweetId);
    return fallbackRes;
  }
}
