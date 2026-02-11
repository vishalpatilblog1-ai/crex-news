// cricket-addictor/fetchCARss.js

import fetch from "node-fetch";
import { parseStringPromise } from "xml2js";
import { setTimeout as delay } from "timers/promises";

const CA_RSS = "https://cricketaddictor.com/feed/";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",

  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",

  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
];

function pickUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

export async function fetchCARSS() {
  console.log("-------- A1 --------");
  await delay(Math.floor(Math.random() * 800));
  console.log("-------- B1 --------");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  console.log("-------- C1 --------");
  let res;
  try {
    res = await fetch(CA_RSS, {
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
    console.log("-------- D1 --------");
  } catch (err) {
    console.log("-------- E1 --------");
    clearTimeout(timeout);
    throw new Error(
      `CA RSS network error: ${err.name || ""} ${err.message || err}`
    );
  }

  clearTimeout(timeout);
  console.log("-------- F1 --------");

  if (!res.ok) {
    throw new Error(`CA RSS HTTP ${res.status} ${res.statusText}`);
  }
  console.log("-------- G1 --------");
  const xml = await res.text();
  console.log("-------- H1 --------");

  try {
    const parsed = await parseStringPromise(xml, {
      explicitArray: false,
      mergeAttrs: true,
      trim: true,
    });
    console.log("-------- I1 --------", parsed);
    return parsed?.rss?.channel?.item || [];
  } catch (err) {
    throw new Error(`CA RSS parse error: ${err.message || err}`);
  }
}
