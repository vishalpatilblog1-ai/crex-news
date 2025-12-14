import {
  postTweet_console_bbc,
  postTweet_web_bcci,
} from "../twitter/twitter.js";
import { saveState } from "../utils/stateStoreCloud.js";
import { generateBBCNewsTweet } from "./ai/generateBBCNewsTweet.js";
import { isBBCArticle } from "./bbcFilters.js";
import { fetchBBCCricketRSS } from "./bbcRssFetcher.js";
import { fetchBBCArticle } from "./fetchBBCArticle.js";
import { parseBBCArticle } from "./parseBBCArticle.js";

export async function bbcNewsPollingLoop() {
  if (!global.STATE) {
    console.log("⚠️ global.STATE not ready. Skipping BBC V2 polling.");
    return;
  }

  const STATE = global.STATE;

  try {
    const items = await fetchBBCCricketRSS();
    if (!Array.isArray(items) || items.length === 0) {
      console.log("ℹ️ No BBC RSS items found");
      return;
    }

    const item = items.find(isBBCArticle);
    if (!item) {
      console.log("ℹ️ No valid BBC cricket article found");
      return;
    }

    const guid = item?.guid?._;
    if (!guid) {
      console.log("⚠️ BBC item missing GUID, skipping");
      return;
    }

    const newsKey = `news_${guid}`;

    if (STATE[newsKey]) {
      console.log("🟡 BBC news already tweeted:", guid);
      return;
    }

    STATE[newsKey] = true;
    await saveState(STATE);

    console.log("🆕 BBC news detected:", item.title);

    const html = await fetchBBCArticle(item.link);
    const article = parseBBCArticle(html);

    if (!article?.body) {
      console.log("⚠️ Empty BBC article body, skipping");
      return;
    }

    const tweetBody = await generateBBCNewsTweet(article.body);
    const cleanUrl = item.link.split("?")[0];

    const tweetText = `${tweetBody}

📰 BBC Sport 🔗 ${cleanUrl}`;

    await postTweet_web_bcci({ text: tweetText });
    // await postTweet_console_bbc({ text: tweetText });

    console.log("🟢 BBC news tweeted successfully:", guid);
  } catch (err) {
    console.error("❌ ERROR in BBC V2 polling:", err);
  }
}
