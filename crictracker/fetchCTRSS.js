import fetch from "node-fetch";
import { XMLParser } from "fast-xml-parser";

const FEED_URL = "https://www.crictracker.com/feed";

export async function fetchCTRSS() {
  const res = await fetch(FEED_URL);
  if (!res.ok) return [];

  const xml = await res.text();
  const parser = new XMLParser({
    ignoreAttributes: false,
  });

  const json = parser.parse(xml);
  return json?.rss?.channel?.item || [];
}
