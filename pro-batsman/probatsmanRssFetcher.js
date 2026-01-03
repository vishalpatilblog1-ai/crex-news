// probatsmanRssFetcher.js
import fetch from "node-fetch";
import { parseStringPromise } from "xml2js";

const PROBATSMAN_RSS = "https://www.probatsman.com/feed/";

export async function fetchProBatsmanRSS() {
  const res = await fetch(PROBATSMAN_RSS, {
    headers: {
      "User-Agent": "Mozilla/5.0 (NewsBot)",
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch ProBatsman RSS");
  }

  const xml = await res.text();

  const parsed = await parseStringPromise(xml, {
    explicitArray: false,
    mergeAttrs: true,
  });

  return parsed?.rss?.channel?.item || [];
}
