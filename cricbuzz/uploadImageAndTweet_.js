import { TwitterApi } from "twitter-api-v2";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();

const client = new TwitterApi({
  appKey: process.env.X_API_KEY,
  appSecret: process.env.X_API_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_SECRET,
});

const rwClient = client.readWrite;

export async function uploadImageAndTweet(text, imagePath) {
  try {
    console.log("📤 Uploading image...");

    const mediaData = fs.readFileSync(imagePath);

    const mediaId = await rwClient.v1.uploadMedia(mediaData, {
      mimeType: "image/png",
    });

    console.log("✅ Image uploaded, media_id:", mediaId);

    const tweet = await rwClient.v2.tweet({
      text,
      media: { media_ids: [mediaId] },
    });

    console.log("🚀 Tweet posted:", tweet);

    return tweet;
  } catch (err) {
    console.error("❌ Failed:", err);
  }
}

uploadImageAndTweet("🔥 Automated scorecard update!", "./images/scorecard.png");
