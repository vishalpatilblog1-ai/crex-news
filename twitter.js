// twitter.js
import { TwitterApi } from "twitter-api-v2";
import dotenv from "dotenv";

dotenv.config();

const twitterClient = new TwitterApi({
  appKey: process.env.X_API_KEY,
  appSecret: process.env.X_API_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_SECRET,
});

export default async function postTweet(text) {
  try {
    const res = await twitterClient.v2.tweet(text);
    console.log("Tweet Response:", res);
    return res.data;
  } catch (err) {
    console.error("❌ Error posting tweet:", err);
  }
}
