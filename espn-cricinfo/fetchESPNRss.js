// espn-cricinfo/fetchESPNRss.js

import axios from "axios";
import { XMLParser } from "fast-xml-parser";

const ESPN_RSS_URL =
  "https://www.espncricinfo.com/rss/content/story/feeds/0.xml";

export async function fetchESPNRss() {
  try {
    const { data } = await axios.get(ESPN_RSS_URL, {
      timeout: 10000,
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "",
    });

    const json = parser.parse(data);

    const items = json?.rss?.channel?.item || [];

    // Normalize to array
    const normalized = Array.isArray(items) ? items : [items];

    return normalized.map((item) => {
      const storyId =
        item.link?.match(/\/story\/(\d+)\.html/)?.[1] ||
        item.guid?.match(/\/story\/(\d+)\.html/)?.[1];

      return {
        title: item.title,
        link: item.link,
        canonicalId: storyId, // we'll use this to build the fetch URL
        pubDate: new Date(item.pubDate).getTime(),
        description: item.description,
        guid: item.guid,
      };
    });

    // return normalized.map((item) => ({
    //   title: item.title,
    //   link: item.link,
    //   pubDate: new Date(item.pubDate).getTime(),
    //   description: item.description,
    //   guid: item.guid,
    // }));
  } catch (error) {
    console.error("❌ fetchESPNRss error:", error.message);
    return [];
  }
}
