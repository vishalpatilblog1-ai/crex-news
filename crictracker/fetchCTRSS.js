// crictracker/fetchCTRSS.js

import fetch from "node-fetch";
import { XMLParser } from "fast-xml-parser";
import { setTimeout as delay } from "timers/promises";

const FEED_URL = "https://www.crictracker.com/feed";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
];

function pickUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

export async function fetchCTRSS() {
  // light jitter (0–500ms)
  await delay(Math.floor(Math.random() * 500));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  let res;
  try {
    res = await fetch(FEED_URL, {
      signal: controller.signal,
      headers: {
        "User-Agent": pickUA(),
        Accept: "application/rss+xml, application/xml, text/xml;q=0.9",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    clearTimeout(timeout);
    console.warn(
      "⚠️ CT RSS network error:",
      err?.name || "",
      err?.message || err
    );
    return [];
  }

  clearTimeout(timeout);

  if (!res.ok) {
    console.warn(`⚠️ CT RSS HTTP ${res.status} ${res.statusText}`);
    return [];
  }

  let xml;
  try {
    xml = await res.text();
  } catch (err) {
    console.warn("⚠️ CT RSS read error:", err?.message || err);
    return [];
  }

  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      trimValues: true,
    });

    const json = parser.parse(xml);
    return json?.rss?.channel?.item || [];
  } catch (err) {
    console.warn("⚠️ CT RSS parse error:", err?.message || err);
    return [];
  }
}
