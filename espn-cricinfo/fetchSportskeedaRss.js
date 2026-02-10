// sportskeeda/fetchSportskeedaRss.js

import fetch from "node-fetch";
import { parseStringPromise } from "xml2js";
import { setTimeout as delay } from "timers/promises";

const SPORTSKEEDA_RSS =
  "https://api.sportskeeda.com/v3/feeds_v2/1414?limit=1000&response_type=w3c";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
];

function pickUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

export async function fetchSportskeedaRss() {
  // small jitter to avoid looking robotic
  await delay(Math.floor(Math.random() * 800));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  let res;
  try {
    res = await fetch(SPORTSKEEDA_RSS, {
      signal: controller.signal,
      headers: {
        "User-Agent": pickUA(),
        Accept:
          "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://www.google.com/",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    clearTimeout(timeout);
    throw new Error(
      `Sportskeeda RSS network error: ${err.name || ""} ${err.message || err}`
    );
  }

  clearTimeout(timeout);

  if (!res.ok) {
    throw new Error(`Sportskeeda RSS HTTP ${res.status} ${res.statusText}`);
  }

  const xml = await res.text();

  try {
    const parsed = await parseStringPromise(xml, {
      explicitArray: false,
      mergeAttrs: true,
      trim: true,
    });

    const items = parsed?.rss?.channel?.item;

    if (!items) return [];

    // Always return array
    return Array.isArray(items) ? items : [items];
  } catch (err) {
    throw new Error(`Sportskeeda RSS parse error: ${err.message || err}`);
  }
}
