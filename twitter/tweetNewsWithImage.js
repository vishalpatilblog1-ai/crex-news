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

// async function downloadImage(url) {
//   fs.mkdirSync("./tmp", { recursive: true });
//   const filePath = "./tmp/news.jpg";

//   const res = await axios.get(url, {
//     responseType: "arraybuffer",
//     headers: {
//       "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
//       "X-RapidAPI-Host": "cricbuzz-cricket.p.rapidapi.com",
//     },
//   });

//   fs.writeFileSync(filePath, res.data);
//   return filePath;
// }

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
