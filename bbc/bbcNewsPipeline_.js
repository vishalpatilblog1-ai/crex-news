// src/news/bbc/bbcNewsPipeline.js

import { fetchBBCCricketRSS } from "./bbcRssFetcher.js";
import { isBBCArticle } from "./bbcFilters.js";
import { getBBCImage } from "./bbcImage.js";
import { downloadImage, uploadImageToTwitter } from "./twitterMedia.js";

// import { isDuplicate, lockPosting, markPosted } from "./dedupe.js";

import { postTweet_console_bbc, postTweet_web_bcci } from "../twitter.js";
import { parseBBCArticle } from "./parseBBCArticle.js";
import { fetchBBCArticle } from "./fetchBBCArticle.js";
import { generateBBCNewsTweet } from "./ai/generateBBCNewsTweet.js";
import { isDuplicateBBC, markBBCPosted } from "./dedupe.js";

export async function runBBCNewsPipeline() {
  console.log("🏏 BBC News pipeline started");

  const items = await fetchBBCCricketRSS();

  for (const item of items) {
    // console.log("items::", item);
    if (!isBBCArticle(item)) continue;

    const guid = item?.guid?._;
    if (!guid) {
      console.log("⚠ Missing GUID, skipping:", item?.title);
      continue;
    }

    // 🚫 Hard dedupe (restart-safe)
    if (isDuplicateBBC(guid)) {
      console.log("⏭ Duplicate skipped:", guid);
      continue;
    }

    // 🔐 LOCK IMMEDIATELY (CRITICAL)
    lockPosting(guid);

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

📰 BBC Sport
🔗 ${cleanUrl}`;

      let mediaIds = [];
      const imageUrl = getBBCImage(item);

      if (imageUrl) {
        try {
          const imagePath = "/tmp/bbc.jpg";
          await downloadImage(imageUrl, imagePath);
          const mediaId = await uploadImageToTwitter(imagePath);
          if (mediaId) mediaIds.push(mediaId);
        } catch (err) {
          console.log("⚠ Image upload failed, posting text only");
        }
      }
      // const res = await postTweet_console_bbc({
      //   text: tweetText,
      //   media_ids: mediaIds.length ? mediaIds : undefined,
      // });

      const res = await postTweet_web_bcci({
        text: tweetText,
        media_ids: mediaIds.length ? mediaIds : undefined,
      });

      if (res?.id) {
        await markBBCPosted(guid);
        console.log("✅ Posted & marked:", guid);
      } else {
        console.log("❌ Tweet failed, dedupe not finalized");
      }

      break;
    } catch (err) {
      console.error("❌ Error while processing BBC item:", guid, err);
    }
  }

  console.log("✅ BBC News pipeline finished");
}
