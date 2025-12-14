// bbcTweetBuilder.js
import { cleanBBCUrl } from "./bbcFilters.js";

export function buildBBCTweet(item) {
  return `🏏 ${item.title}

📰 BBC Sport
🔗 ${cleanBBCUrl(item.link)}`;
}
