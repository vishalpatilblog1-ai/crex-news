// cricket-addictor/fetchCARss.js

import fetch from "node-fetch";
import { parseStringPromise } from "xml2js";

const CA_RSS = "https://cricketaddictor.com/feed/";

export async function fetchCARSS() {
  const res = await fetch(CA_RSS, {
    headers: {
      "User-Agent": "Mozilla/5.0 (CREX-NewsBot)",
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch CricketAddictor RSS");
  }

  const xml = await res.text();

  const parsed = await parseStringPromise(xml, {
    explicitArray: false,
    mergeAttrs: true,
  });

  //   console.log("parsed:::", parsed);
  return parsed?.rss?.channel?.item || [];
}
