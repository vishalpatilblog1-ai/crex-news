import { fetchBBCCricketRSS } from "./bbcRssFetcher.js";
import { isBBCArticle } from "./bbcFilters.js";

import { postTweet_web_bcci } from "../twitter.js";
import { parseBBCArticle } from "./parseBBCArticle.js";
import { fetchBBCArticle } from "./fetchBBCArticle.js";
import { generateBBCNewsTweet } from "./ai/generateBBCNewsTweet.js";

import {
  isDuplicateBBC,
  lockPosting,
  markBBCPosted,
  unlockPosting,
} from "./dedupe.js";

export async function runBBCNewsPipeline() {
  const items = await fetchBBCCricketRSS();

  for (const item of items) {
    if (!isBBCArticle(item)) continue;

    const guid = item?.guid?._;
    if (!guid) {
      console.log("⚠ Missing GUID, skipping:", item?.title);
      continue;
    }

    if (await isDuplicateBBC(guid)) {
      console.log("⏭ Duplicate skipped:", guid);
      continue;
    }

    // await lockPosting(guid);
    const locked = await lockPosting(guid);
    if (!locked) continue;

    try {
      const html = await fetchBBCArticle(item.link);
      const article = parseBBCArticle(html);

      if (!article?.body) {
        console.log("⚠ Empty article body, skipping");
        continue;
      }

      const tweetBody = await generateBBCNewsTweet(article.body);
      const cleanUrl = item.link.split("?")[0];

      const tweetText = `${tweetBody}

📰 BBC Sport 🔗 ${cleanUrl}`;

      const res = await postTweet_web_bcci({ text: tweetText });

      if (res?.id) {
        await markBBCPosted(guid, res.id);
        console.log("✅ Posted & marked:", guid);
      } else if (res?.error?.code === 403) {
        await markBBCPosted(guid, "duplicate-content");
        console.log("⚠ Duplicate content on X, marking as posted:", guid);
      } else {
        console.log("❌ Tweet failed, lock retained");
      }

      break;
    } catch (err) {
      console.error("❌ Error while processing BBC item:", guid, err);
      await unlockPosting(guid);
    }
  }
}
