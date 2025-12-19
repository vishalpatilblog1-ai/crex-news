//bbcNewsPollingLoop.js
import {
  postTweet_bbc_console,
  postTweet_bbc_web,
} from "../twitter/twitter.js";

import { saveState } from "../utils/stateStoreCloud.js";
import { generateBBCNewsTweet } from "./ai/generateBBCNewsTweet.js";
import { generateBBCFallbackTweet } from "./ai/generateBBCFallbackTweet.js";
import { isBBCArticle } from "./bbcFilters.js";
import { fetchBBCCricketRSS } from "./bbcRssFetcher.js";
import { fetchBBCArticle } from "./fetchBBCArticle.js";
import { parseBBCArticle } from "./parseBBCArticle.js";

// =====================================================
// BBC NEWS POLLING LOOP (PRODUCTION SAFE)
// =====================================================
export async function bbcNewsPollingLoop() {
  if (!global.STATE) {
    console.log("⚠️ global.STATE not ready. Skipping BBC polling.");
    return;
  }

  const STATE = global.STATE;

  // ---------------------------------------------------
  // STATE INIT (BACKWARD SAFE)
  // ---------------------------------------------------
  if (!STATE.bbc) STATE.bbc = {};
  if (!STATE.bbc.seen) STATE.bbc.seen = {};
  if (!STATE.bbc.lastPubMs) STATE.bbc.lastPubMs = 0;

  // ---------------------------------------------------
  // CONFIG
  // ---------------------------------------------------
  const TWEET_MAX_AGE_HOURS = Number(process.env.BBC_MAX_AGE_HOURS || 24);
  const SEEN_RETENTION_HOURS = Number(
    process.env.BBC_SEEN_RETENTION_HOURS || 48
  );
  const CONSOLE_ONLY = process.env.BBC_CONSOLE_ONLY === "true";

  const TWEET_MAX_AGE_MS = TWEET_MAX_AGE_HOURS * 60 * 60 * 1000;
  const SEEN_RETENTION_MS = SEEN_RETENTION_HOURS * 60 * 60 * 1000;

  try {
    // ---------------------------------------------------
    // PRUNE OLD SEEN ENTRIES
    // ---------------------------------------------------
    const now = Date.now();
    let pruned = 0;

    for (const [link, ts] of Object.entries(STATE.bbc.seen)) {
      const seenAt = typeof ts === "number" ? ts : 0;
      if (now - seenAt > SEEN_RETENTION_MS) {
        delete STATE.bbc.seen[link];
        pruned++;
      }
    }

    if (pruned > 0) {
      console.log(`🧹 Pruned ${pruned} old BBC seen entries`);
    }

    // ---------------------------------------------------
    // FETCH RSS
    // ---------------------------------------------------
    const items = await fetchBBCCricketRSS();

    if (!Array.isArray(items) || items.length === 0) {
      console.log("ℹ️ No BBC RSS items found");
      return;
    }

    // ---------------------------------------------------
    // FILTER + SORT (NEWEST FIRST)
    // ---------------------------------------------------
    const sortedArticles = items
      .filter(isBBCArticle)
      .sort((a, b) => getPubDate(b) - getPubDate(a));

    let selected = null;

    // ---------------------------------------------------
    // SELECTION LOGIC
    // ---------------------------------------------------
    for (const article of sortedArticles) {
      const pubMs = getPubDate(article);
      if (!pubMs) continue;

      // ⏱️ AGE GUARD
      if (Date.now() - pubMs > TWEET_MAX_AGE_MS) continue;

      const cleanLink = normalizeBBCLink(article.link);

      // 🔁 DEDUPE
      if (STATE.bbc.seen[cleanLink]) continue;

      selected = article;
      break;
    }

    if (!selected) {
      console.log("🟡 No eligible BBC articles (age + dedupe)");
      return;
    }

    console.log(
      "🆕 BBC news detected:",
      selected.title,
      "| pubDate:",
      selected.pubDate,
      "| consoleOnly:",
      CONSOLE_ONLY
    );

    // ---------------------------------------------------
    // FETCH & PARSE ARTICLE
    // ---------------------------------------------------
    const html = await fetchBBCArticle(selected.link);
    const parsed = parseBBCArticle(html);

    // ---------------------------------------------------
    // GENERATE TWEET (AI → FALLBACK)
    // ---------------------------------------------------
    let tweetBody;

    try {
      if (!parsed?.body || parsed.body.length < 50) {
        throw new Error("Article body missing / too short");
      }

      tweetBody = await generateBBCNewsTweet(parsed.body);

      if (!tweetBody || tweetBody.length < 30) {
        throw new Error("AI output invalid");
      }
    } catch (err) {
      console.warn("⚠️ AI failed, using fallback:", err.message);
      tweetBody = generateBBCFallbackTweet(selected);
    }

    const cleanUrl = normalizeBBCLink(selected.link);

    const tweetText = `${tweetBody}

BBC Sport 🔗 ${cleanUrl}`;

    // ---------------------------------------------------
    // POST
    // ---------------------------------------------------
    if (CONSOLE_ONLY) {
      console.log("🟡 CONSOLE MODE — Tweet skipped");
      console.log(tweetText);
    } else {
      console.log("🟡 CONSOLE MODE — else");
      await postTweet_bbc_web({ text: tweetText });
      // await postTweet_bbc_console({ text: tweetText });
    }

    // ---------------------------------------------------
    // UPDATE STATE (AFTER SUCCESS ONLY)
    // ---------------------------------------------------
    const pubMs = getPubDate(selected);

    STATE.bbc.seen[cleanUrl] = Date.now();
    STATE.bbc.lastPubMs = Math.max(STATE.bbc.lastPubMs || 0, pubMs);
    STATE.bbc.visibleDate = new Date(pubMs).toUTCString();
    STATE.bbc.lastLink = cleanUrl;
    STATE.bbc.lastTitle = selected.title;

    // ---------------------------------------------------
    // 🔐 DEFENSIVE SAVE (CRITICAL FIX)
    // ---------------------------------------------------
    STATE.bbc = {
      lastPubMs: STATE.bbc.lastPubMs || 0,
      lastLink: STATE.bbc.lastLink || "",
      lastTitle: STATE.bbc.lastTitle || "",
      visibleDate: STATE.bbc.visibleDate || null,
      seen: STATE.bbc.seen || {},
    };

    console.log("🧠 BBC keys before save:", Object.keys(STATE.bbc));

    await saveState(STATE);

    console.log("🟢 BBC state saved. visibleDate:", STATE.bbc.visibleDate);
  } catch (err) {
    console.error("❌ ERROR in BBC polling:", err);
  }
}

// =====================================================
// HELPERS
// =====================================================
function getPubDate(item) {
  const raw = item?.pubDate;
  return raw ? new Date(raw).getTime() : 0;
}

function normalizeBBCLink(link) {
  return link.split("?")[0].split("#")[0];
}
