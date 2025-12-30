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
  if (!imageUrl) throw new Error("imageUrl missing");

  // Download as buffer
  const res = await axios.get(imageUrl, {
    responseType: "arraybuffer",
    headers: { "User-Agent": "Mozilla/5.0 (CREX-NewsBot)" },
    timeout: 15000,
  });

  const mimeType = guessMime(imageUrl, res.headers?.["content-type"]);
  const mediaId = await rwClient.v1.uploadMedia(Buffer.from(res.data), {
    mimeType,
  });
  console.log("ready tweet::", {
    text,
    media: { media_ids: [mediaId] },
  });

  // Tweet with native media (image expands, no outbound click)
  return rwClient.v2.tweet({
    text,
    media: { media_ids: [mediaId] },
  });
}
