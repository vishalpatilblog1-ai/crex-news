import dotenv from "dotenv";
dotenv.config();

import axios from "axios";
import fs from "fs";
import path from "path";
import { TwitterApi } from "twitter-api-v2";

const client = new TwitterApi({
  appKey: process.env.X_API_KEY,
  appSecret: process.env.X_API_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_SECRET,
});
const rwClient = client.readWrite;

// export async function tweetNewsWithImage(text, imageUrl) {
//   try {
//     const EXPERIMENT_TAGS = [];

//     let finalText = text;

//     const missingTags = EXPERIMENT_TAGS.filter(
//       (tag) => !finalText.includes(tag)
//     );

//     if (missingTags.length > 0) {
//       finalText += `\n\n${missingTags.join(" ")}`;
//     }
//     console.log("⬇ Downloading image...");
//     const downloadedPath = await downloadImage(imageUrl);

//     console.log("📤 Uploading image to Twitter...");
//     const data = fs.readFileSync(downloadedPath);
//     const mediaId = await rwClient.v1.uploadMedia(data, {
//       mimeType: "image/jpeg",
//     });

//     console.log("📝 Tweeting...");
//     const tweet = await rwClient.v2.tweet({
//       text: finalText,
//       media: { media_ids: [mediaId] },
//     });

//     console.log("🚀 Tweet Posted:", tweet.data.id);

//     fs.unlinkSync(downloadedPath);
//     return tweet;
//   } catch (err) {
//     console.error("❌ Error tweeting news image:", err);
//   }
// }
