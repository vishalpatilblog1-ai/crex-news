import fetch from "node-fetch";
import { parseStringPromise } from "xml2js";

const NDTV_CRICKET_RSS = "http://feeds.feedburner.com/ndtvsports-cricket";

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

  // console.log("parsed:::", parsed);

  const rawItems = parsed?.rss?.channel?.[0]?.item || [];

  // console.log("rawItems::", rawItems);

  // Normalize structure
  return rawItems.map((item) => ({
    title: item.title?.[0] || "",
    link: item.link?.[0] || "",
    pubDate: item.pubDate?.[0] || "",
    description: item.description?.[0] || "",
    "media:content": item["media:content"]?.[0] || null,
  }));
}
