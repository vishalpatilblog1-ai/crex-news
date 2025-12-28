// hinduRssFetcher.js
import fetch from "node-fetch";
import { parseStringPromise } from "xml2js";

// Hindu Cricket RSS
const HINDU_CRICKET_RSS =
  "https://www.thehindu.com/sport/cricket/feeder/default.rss";

export async function fetchHinduCricketRSS() {
  const res = await fetch(HINDU_CRICKET_RSS, {
    headers: {
      "User-Agent": "Mozilla/5.0 (NewsBot)",
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch The Hindu RSS");
  }

  const xml = await res.text();

  const parsed = await parseStringPromise(xml, {
    explicitArray: false,
    mergeAttrs: true,
  });

  // Normalized output similar to BBC / IE
  return parsed?.rss?.channel?.item || [];
}
