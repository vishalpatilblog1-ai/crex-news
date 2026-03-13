import fetch from "node-fetch";
import fs from "fs";

/**
 * Akamai blocks requests with image manipulation query params (?im=...).
 * Strip them and fetch the base image URL instead.
 */
function cleanImageUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.search = ""; // remove all query params incl. ?im=FeatureCrop,...
    return parsed.toString();
  } catch {
    return url;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
];

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

export async function downloadNDTVImage(url) {
  fs.mkdirSync("./tmp", { recursive: true });

  const filePath = "./tmp/ndtv-news.jpg";
  const cleanUrl = cleanImageUrl(url);

  if (cleanUrl !== url) {
    console.log(`🧹 Cleaned image URL: ${cleanUrl}`);
  }

  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (attempt > 1) await sleep(400 * attempt + Math.random() * 300);

    try {
      const res = await fetch(cleanUrl, {
        headers: {
          "User-Agent": randomUA(),
          Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
          "Accept-Language": "en-IN,en-GB;q=0.9,en-US;q=0.8,en;q=0.7",
          "Accept-Encoding": "gzip, deflate, br",
          Referer: "https://sports.ndtv.com/cricket",
          "Sec-Fetch-Dest": "image",
          "Sec-Fetch-Mode": "no-cors",
          "Sec-Fetch-Site": "cross-site",
          Connection: "keep-alive",
          DNT: "1",
        },
      });

      if (res.status === 403) {
        console.warn(`⚠️ Image CDN 403 on attempt ${attempt}/${maxRetries}`);
        if (attempt === maxRetries) {
          throw new Error(
            `Image download failed after ${maxRetries} attempts: 403 Forbidden`
          );
        }
        continue;
      }

      if (!res.ok) {
        throw new Error(`Image download failed: ${res.status}`);
      }

      const buffer = await res.buffer();
      fs.writeFileSync(filePath, buffer);

      console.log(`✅ Image downloaded (${buffer.length} bytes): ${cleanUrl}`);
      return filePath;
    } catch (err) {
      if (attempt === maxRetries) throw err;
      console.warn(
        `⚠️ downloadNDTVImage attempt ${attempt} failed: ${err.message}`
      );
    }
  }
}
