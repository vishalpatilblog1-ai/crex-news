// twitterMedia.js
import fetch from "node-fetch";
import fs from "fs";

export async function downloadImage(url, filePath) {
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  fs.writeFileSync(filePath, Buffer.from(buffer));
}

// ASSUME YOU ALREADY HAVE THIS
export async function uploadImageToTwitter(filePath) {
  // your existing upload logic
  // returns media_id
}
