// bbcRssFetcher.js
import fetch from "node-fetch";
import { parseStringPromise } from "xml2js";

const BBC_CRICKET_RSS = "https://feeds.bbci.co.uk/sport/cricket/rss.xml";

export async function fetchBBCCricketRSS() {
  const res = await fetch(BBC_CRICKET_RSS, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch BBC RSS");
  }

  const xml = await res.text();
  const parsed = await parseStringPromise(xml, {
    explicitArray: false,
    mergeAttrs: true,
  });

  return parsed.rss.channel.item;
}
