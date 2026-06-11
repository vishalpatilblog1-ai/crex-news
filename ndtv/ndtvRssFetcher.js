import fetch from "node-fetch";
import { parseStringPromise } from "xml2js";

const NDTV_CRICKET_RSS = "http://feeds.feedburner.com/ndtvsports-cricket";
const NDTV_SPORTS_LATEST_RSS = "https://feeds.feedburner.com/ndtvsports-latest";

export async function fetchNDTVCricketRSS() {
  const res = await fetch(NDTV_CRICKET_RSS, {
    headers: { "User-Agent": "Mozilla/5.0 (CREX-NewsBot)" },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch NDTV RSS");
  }

  const xml = await res.text();

  const parsed = await parseStringPromise(xml, {
    explicitArray: true,
    mergeAttrs: true,
  });

  const rawItems = parsed?.rss?.channel?.[0]?.item || [];

  // Normalize structure
  return rawItems.map((item) => ({
    title: item.title?.[0] || "",
    link: item.link?.[0] || "",
    pubDate: item.pubDate?.[0] || "",
    description: item.description?.[0] || "",
    "media:content": item["media:content"]?.[0] || null,
  }));
}

export async function fetchNDTVFootballRSS() {
  const res = await fetch(NDTV_SPORTS_LATEST_RSS, {
    headers: {
      "User-Agent": "Mozilla/5.0 (CREX-NewsBot)",
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch NDTV Football RSS");
  }

  const xml = await res.text();

  const parsed = await parseStringPromise(xml, {
    explicitArray: true,
    mergeAttrs: true,
  });

  const rawItems = parsed?.rss?.channel?.[0]?.item || [];

  return rawItems
    .map((item) => ({
      title: item.title?.[0] || "",
      link: item.link?.[0] || "",
      pubDate: item.pubDate?.[0] || "",
      description: item.description?.[0] || "",
      content: item["content:encoded"]?.[0] || "",
      "media:content": item["media:content"]?.[0] || null,
    }))
    .filter((item) => item.link?.includes("/football/"));
}
