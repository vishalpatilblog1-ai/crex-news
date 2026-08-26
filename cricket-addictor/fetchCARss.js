// cricket-addictor/fetchCARss.js

import fetch from "node-fetch";
import { parseStringPromise } from "xml2js";
import { setTimeout as delay } from "timers/promises";

const CA_RSS = "https://cricketaddictor.com/feed/";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
];

function pickUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

const RETRY_DELAYS_MS = [2000, 5000, 12000]; // 3 attempts with backoff

async function fetchWithRetry(ua, attempt = 0) {
  await delay(Math.floor(Math.random() * 1000) + 500); // 500–1500ms jitter

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000); // bumped to 20s

  let res;
  try {
    res = await fetch(CA_RSS, {
      signal: controller.signal,
      headers: {
        "User-Agent": ua,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        Referer: "https://www.google.com/search?q=cricket+news",
        Connection: "keep-alive",
        "Cache-Control": "no-cache",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "cross-site",
        "Upgrade-Insecure-Requests": "1",
      },
    });
  } catch (err) {
    clearTimeout(timeout);

    if (attempt < RETRY_DELAYS_MS.length) {
      console.warn(
        `⚠️ CA RSS attempt ${attempt + 1} failed (${err.name}), retrying in ${
          RETRY_DELAYS_MS[attempt]
        }ms...`,
      );
      await delay(RETRY_DELAYS_MS[attempt]);
      return fetchWithRetry(ua, attempt + 1);
    }

    throw new Error(
      `CA RSS network error after ${attempt + 1} attempts: ${err.name} ${
        err.message
      }`,
    );
  }

  clearTimeout(timeout);

  // 525 = Cloudflare SSL handshake fail — retryable
  // 429 = rate limited — retryable with backoff
  // 5xx = server error — retryable
  const retryableStatus = [429, 500, 502, 503, 504, 525, 526];

  if (
    retryableStatus.includes(res.status) &&
    attempt < RETRY_DELAYS_MS.length
  ) {
    console.warn(
      `⚠️ CA RSS attempt ${attempt + 1} got HTTP ${res.status}, retrying in ${
        RETRY_DELAYS_MS[attempt]
      }ms...`,
    );
    await delay(RETRY_DELAYS_MS[attempt]);
    return fetchWithRetry(ua, attempt + 1);
  }

  if (!res.ok) {
    throw new Error(`CA RSS HTTP ${res.status} ${res.statusText}`);
  }

  return res;
}

export async function fetchCARSS() {
  const ua = pickUA(); // pick once per poll cycle so retries look like the same client
  const res = await fetchWithRetry(ua);
  const xml = await res.text();

  try {
    const parsed = await parseStringPromise(xml, {
      explicitArray: false,
      mergeAttrs: true,
      trim: true,
    });

    return parsed?.rss?.channel?.item || [];
  } catch (err) {
    throw new Error(`CA RSS parse error: ${err.message || err}`);
  }
}
