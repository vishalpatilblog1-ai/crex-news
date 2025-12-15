import {
  postTweet_bbc_console,
  postTweet_bbc_web,
} from "../twitter/twitter.js";
import { saveState } from "../utils/stateStoreCloud.js";
import { generateBBCNewsTweet } from "./ai/generateBBCNewsTweet.js";
import { isBBCArticle } from "./bbcFilters.js";
import { fetchBBCCricketRSS } from "./bbcRssFetcher.js";
import { fetchBBCArticle } from "./fetchBBCArticle.js";
import { parseBBCArticle } from "./parseBBCArticle.js";

export async function bbcNewsPollingLoop() {
  if (!global.STATE) {
    console.log("⚠️ global.STATE not ready. Skipping BBC polling.");
    return;
  }

  const STATE = global.STATE;

  // ✅ ensure BBC namespace exists (backward-safe)
  if (!STATE.bbc) {
    STATE.bbc = {};
  }

  try {
    const items = await fetchBBCCricketRSS();

    if (!Array.isArray(items) || items.length === 0) {
      console.log("ℹ️ No BBC RSS items found");
      return;
    }

    // ✅ watermark (default = 0 for first run)
    const lastPubMs = STATE.bbc.lastPubMs || 0;

    // 1️⃣ Filter + sort newest first
    const sortedArticles = items
      .filter(isBBCArticle)
      .sort((a, b) => getPubDate(b) - getPubDate(a));

    let selected = null;

    // 2️⃣ Pick first article newer than watermark
    for (const article of sortedArticles) {
      const pubMs = getPubDate(article);
      if (!pubMs) continue;

      if (pubMs > lastPubMs) {
        selected = article;
        break;
      }
    }

    if (!selected) {
      console.log("🟡 No newer BBC articles since last poll");
      return;
    }

    console.log(
      "🆕 BBC news detected:",
      selected.title,
      "| pubDate:",
      selected.pubDate
    );

    // 3️⃣ Fetch & parse article
    const html = await fetchBBCArticle(selected.link);
    const parsed = parseBBCArticle(html);

    if (!parsed?.body) {
      console.log("⚠️ Empty BBC article body, skipping");
      return;
    }

    const tweetBody = await generateBBCNewsTweet(parsed.body);
    const cleanUrl = selected.link.split("?")[0];

    const tweetText = `${tweetBody}

📰 BBC Sport 🔗 ${cleanUrl}`;

    // await postTweet_bbc_console({ text: tweetText });
    await postTweet_bbc_web({ text: tweetText });

    // 4️⃣ Update BBC state AFTER successful tweet
    STATE.bbc.lastPubMs = getPubDate(selected);
    STATE.bbc.lastLink = cleanUrl;
    STATE.bbc.lastTitle = selected.title;

    await saveState(STATE);

    console.log(
      "🟢 BBC news tweeted successfully. Watermark updated:",
      STATE.bbc.lastPubMs
    );
  } catch (err) {
    console.error("❌ ERROR in BBC polling:", err);
  }
}

// ---------- helpers ----------

function getPubDate(item) {
  const raw = item?.pubDate;
  return raw ? new Date(raw).getTime() : 0;
}
