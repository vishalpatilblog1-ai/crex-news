import fetch from "node-fetch";

const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
];

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchNDTVArticle(url) {
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Small random delay to avoid looking like a bot (300–900ms)
      if (attempt > 1) await sleep(300 * attempt + Math.random() * 400);

      const res = await fetch(url, {
        headers: {
          "User-Agent": randomUA(),
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "en-IN,en-GB;q=0.9,en-US;q=0.8,en;q=0.7",
          "Accept-Encoding": "gzip, deflate, br",
          Connection: "keep-alive",
          "Cache-Control": "max-age=0",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "none",
          "Sec-Fetch-User": "?1",
          "Upgrade-Insecure-Requests": "1",
          Referer: "https://www.ndtv.com/cricket",
          DNT: "1",
        },
        redirect: "follow",
      });

      if (res.status === 403) {
        console.warn(`⚠️ NDTV 403 on attempt ${attempt}/${maxRetries}`);
        if (attempt === maxRetries) {
          throw new Error(
            `Failed to fetch article after ${maxRetries} attempts: 403 Forbidden`
          );
        }
        continue;
      }

      if (!res.ok) {
        throw new Error(`Failed to fetch article: ${res.status}`);
      }

      return await res.text();
    } catch (err) {
      if (attempt === maxRetries) throw err;
      console.warn(
        `⚠️ fetchNDTVArticle attempt ${attempt} failed: ${err.message}`
      );
    }
  }
}
