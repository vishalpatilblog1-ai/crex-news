import axios from "axios";
import { TwitterApi } from "twitter-api-v2";

const client = new TwitterApi({
  appKey: process.env.X_API_KEY,
  appSecret: process.env.X_API_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_SECRET,
});

const rwClient = client.readWrite;

function guessMime(url, contentType) {
  if (contentType?.includes("png")) return "image/png";
  if (contentType?.includes("jpeg") || contentType?.includes("jpg"))
    return "image/jpeg";

  const u = (url || "").toLowerCase();
  if (u.endsWith(".png")) return "image/png";
  return "image/jpeg"; // safe default for IE images
}

export async function tweetWithNativeImage({ text, imageUrl }) {
  try {
    if (!imageUrl) {
      throw new Error("imageUrl missing");
    }

    // 1️⃣ Download image
    const res = await axios.get(imageUrl, {
      responseType: "arraybuffer",
      headers: { "User-Agent": "Mozilla/5.0 (CREX-NewsBot)" },
      timeout: 15000,
    });

    // 2️⃣ Detect mime
    const mimeType = guessMime(imageUrl, res.headers?.["content-type"]);

    // 3️⃣ Upload media to Twitter
    const mediaId = await rwClient.v1.uploadMedia(Buffer.from(res.data), {
      mimeType,
    });

    console.log("ready tweet::", {
      text,
      media: { media_ids: [mediaId] },
    });

    // 4️⃣ Post tweet
    return await rwClient.v2.tweet({
      text,
      media: { media_ids: [mediaId] },
    });
  } catch (err) {
    console.error("❌ Error tweeting news image:", err);
  }
}

// export async function tweetWithNativeImage({ text, imageUrl }) {
//   if (!imageUrl) throw new Error("imageUrl missing");

//   const res = await axios.get(imageUrl, {
//     responseType: "arraybuffer",
//     headers: { "User-Agent": "Mozilla/5.0 (CREX-NewsBot)" },
//     timeout: 15000,
//   });

//   const mimeType = guessMime(imageUrl, res.headers?.["content-type"]);
//   const mediaId = await rwClient.v1.uploadMedia(Buffer.from(res.data), {
//     mimeType,
//   });
//   console.log("ready tweet::", {
//     text,
//     media: { media_ids: [mediaId] },
//   });

//   return rwClient.v2.tweet({
//     text,
//     media: { media_ids: [mediaId] },
//   });
// }
