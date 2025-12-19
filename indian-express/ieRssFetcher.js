import fetch from "node-fetch";
import { parseStringPromise } from "xml2js";

const IE_CRICKET_RSS = "https://indianexpress.com/section/sports/cricket/feed/";

export async function fetchIECricketRSS() {
  const res = await fetch(IE_CRICKET_RSS, {
    headers: { "User-Agent": "Mozilla/5.0 (CREX-NewsBot)" },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch IE RSS");
  }

  const xml = await res.text();

  const parsed = await parseStringPromise(xml, {
    explicitArray: false,
    mergeAttrs: true,
  });

  return parsed?.rss?.channel?.item || [];
}
