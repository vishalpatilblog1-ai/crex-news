import dotenv from "dotenv";
import { TwitterApi } from "twitter-api-v2";

dotenv.config();

const client = new TwitterApi({
  appKey: process.env.X_API_KEY,
  appSecret: process.env.X_API_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_SECRET,
});

const rwClient = client.readWrite;

// 👉 Delete tweets BEFORE this date
// const CUTOFF_DATE = new Date("2026-04-010T00:00:00Z");
const CUTOFF_DATE = new Date("2026-04-10T00:00:00Z");

// 👉 Safety toggle
const DRY_RUN = false;

// 👉 Fast mode (auto handles rate limit)
const DELAY_MS = 20000;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function deleteMediaTweets() {
  try {
    const me = await rwClient.v2.me();
    const userId = me.data.id;

    console.log("🚀 Starting cleanup...");
    console.log("User ID:", userId);
    console.log("Cutoff:", CUTOFF_DATE.toISOString());
    console.log("DRY_RUN:", DRY_RUN);
    console.log("=================================\n");

    let paginator = await rwClient.v2.userTimeline(userId, {
      max_results: 100,
      expansions: ["attachments.media_keys"],
      "tweet.fields": ["created_at", "attachments", "text"],
      "media.fields": ["type"],
    });

    let deletedCount = 0;
    let checkedCount = 0;

    while (true) {
      const tweets = paginator.data.data || [];
      for (const tweet of tweets) {
        checkedCount++;

        const tweetDate = new Date(tweet.created_at);

        // 👉 Only delete tweets before April 1
        // if (tweetDate >= CUTOFF_DATE) continue;

        const cleanText = tweet.text?.replace(/\n/g, " ");
        const tweetUrl = `https://twitter.com/i/web/status/${tweet.id}`;

        console.log("\n---------------------------");
        console.log(`🗑️ Candidate Tweet`);
        console.log(`🔗 URL  : ${tweetUrl}`);
        console.log(`📅 Date : ${tweet.created_at}`);
        console.log(`📝 Text : ${cleanText}`);
        console.log("---------------------------");

        if (!DRY_RUN) {
          try {
            await rwClient.v2.deleteTweet(tweet.id);

            deletedCount++;
            console.log(`✅ Deleted: ${tweet.id}`);

            await wait(DELAY_MS);
          } catch (err) {
            if (err.code === 429 || err?.data?.title === "Too Many Requests") {
              console.log("⏳ Rate limit hit. Waiting 15 minutes...");
              await wait(15 * 60 * 1000);
              console.log("🔄 Resuming...");
              continue;
            }

            console.error("❌ Delete failed:", tweet.id, err.message);
          }
        } else {
          console.log("🧪 DRY RUN - Not deleting");
        }
      }

      if (!paginator.hasNext) break;
      paginator = await paginator.fetchNext();
    }

    console.log("\n=================================");
    console.log("🎯 DONE");
    console.log(`Checked: ${checkedCount}`);
    console.log(`Deleted: ${deletedCount}`);
    console.log("=================================");
  } catch (error) {
    console.error("❌ Fatal Error:", error);
  }
}

deleteMediaTweets();
