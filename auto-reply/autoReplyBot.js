import { TwitterApi } from "twitter-api-v2";
import dotenv from "dotenv";
import { generateAIReply } from "./generateAIReply";
import { generateMufaStyleAIReply } from "./generateMufaStyleAIReply";
import { shouldReplyToMufa } from "./replyManager";
import { isHighQualityTweet } from "./tweetQuality";
dotenv.config();

// ⚠️ Use OAuth1.0a client (User context)
const client = new TwitterApi({
  appKey: process.env.X_API_KEY,
  appSecret: process.env.X_API_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_SECRET,
});

const rwClient = client.readWrite;

globalThis.REPLIED = {};
const TARGET_ACCOUNTS = ["VishalReacts"];

async function searchLatestTweet(username) {
  const res = await rwClient.v2.search(
    `from:${username} -is:retweet -is:reply`,
    {
      max_results: 10,
    }
  );

  const tweets = res?.tweets || [];
  return tweets.length ? tweets[0] : null;
}

async function replyToTweet(tweetId, text) {
  return await rwClient.v2.tweet({
    text,
    reply: { in_reply_to_tweet_id: tweetId },
  });
}

// async function generateAIReply(tweetText) {
//   return `Auto-reply test successful! 🤖🔥`;
// }

async function processAccount(username) {
  const latest = await searchLatestTweet(username);
  if (!latest) return;

  const tweetId = latest.id;
  const text = latest.text;

  if (globalThis.REPLIED[username] === tweetId) {
    console.log(`Already replied to ${tweetId}`);
    return;
  }

  if (!shouldReplyToMufa()) return;

  if (!isHighQualityTweet(text)) {
    console.log("⏭ Low quality tweet — skipping reply.");
    return;
  }

  const reply = await generateMufaStyleAIReply(text);
  const posted = await replyToTweet(tweetId, reply);

  console.log("🔥 Replied to Mufa:", posted);
  incrementMufaReplyCount();

  //   const aiMufaReply = await generateMufaStyleAIReply(tweet.text);
  //   const posted = await replyToTweet(tweetId, aiMufaReply);
  //   console.log("Replied:", posted);

  globalThis.REPLIED[username] = tweetId;
}

setInterval(() => processAccount("VishalReacts"), 10000);

console.log("🔥 Auto-reply bot started…");
