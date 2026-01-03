// bbcNewsPollingLoop.js

import { postTweet_bbc_web } from "../twitter/twitter.js";

import { saveState } from "../utils/stateStoreCloud.js";
import { generateBBCFallbackTweet } from "./ai/generateBBCFallbackTweet.js";
import { generateBBCNewsTweet } from "./ai/generateBBCNewsTweet.js";

import { judgeNewsContext } from "./ai/judgeNewsContext.js";
import { isBBCArticle } from "./bbcFilters.js";
import { fetchBBCCricketRSS } from "./bbcRssFetcher.js";
import { fetchBBCArticle } from "./fetchBBCArticle.js";
import { getBBCImageUrl, upgradeBBCImage } from "./getBBCImageUrl.js";
import { parseBBCArticle } from "./parseBBCArticle.js";
import { tweetWithNativeImage } from "./tweetWithNativeImage.js";

export async function bbcNewsPollingLoop() {
  if (!global.STATE) {
    console.log("⚠️ global.STATE not ready. Skipping BBC polling.");
    return;
  }

  const STATE = global.STATE;

  if (!STATE.bbc) STATE.bbc = {};
  if (!STATE.bbc.seen) STATE.bbc.seen = {};
  if (!STATE.bbc.lastPubMs) STATE.bbc.lastPubMs = 0;

  const TWEET_MAX_AGE_HOURS = Number(process.env.BBC_MAX_AGE_HOURS || 24);
  const SEEN_RETENTION_HOURS = Number(
    process.env.BBC_SEEN_RETENTION_HOURS || 48
  );
  const CONSOLE_ONLY = process.env.CONSOLE_ONLY === "true";

  const TWEET_MAX_AGE_MS = TWEET_MAX_AGE_HOURS * 60 * 60 * 1000;
  const SEEN_RETENTION_MS = SEEN_RETENTION_HOURS * 60 * 60 * 1000;

  try {
    const now = Date.now();
    let pruned = 0;

    for (const [link, ts] of Object.entries(STATE.bbc.seen)) {
      if (now - ts > SEEN_RETENTION_MS) {
        delete STATE.bbc.seen[link];
        pruned++;
      }
    }

    if (pruned > 0) {
      console.log(`🧹 Pruned ${pruned} old BBC seen entries`);
    }

    const items = await fetchBBCCricketRSS();

    if (!Array.isArray(items) || items.length === 0) {
      console.log("ℹ️ No BBC RSS items found");
      return;
    }

    const sortedArticles = items
      .filter(isBBCArticle)
      .sort((a, b) => getPubDate(b) - getPubDate(a));

    let selected = null;

    for (const article of sortedArticles) {
      const pubMs = getPubDate(article);
      if (!pubMs) continue;

      if (Date.now() - pubMs > TWEET_MAX_AGE_MS) continue;

      const cleanLink = normalizeBBCLink(article.link);

      if (STATE.bbc.seen[cleanLink]) continue;

      selected = article;
      break;
    }

    if (!selected) {
      console.log("🟡 No eligible BBC articles (age + link dedupe)");
      return;
    }

    const html = await fetchBBCArticle(selected.link);
    const parsed = parseBBCArticle(html);

    if (!parsed?.body || parsed.body.length < 50) {
      console.warn("⚠️ Parsed article body missing / too short");
      return;
    }

    let contextDecision = null;

    try {
      contextDecision = await judgeNewsContext({
        articleText: parsed.body,
        existingContexts: STATE.dailyContext.contexts.map((c) => c.summary),
      });

      if (
        contextDecision?.isAlreadyCovered === true &&
        contextDecision?.confidence >= 0.8
      ) {
        console.log("🔁 Skipping BBC article (context already covered)");
        console.log("↳ Context:", contextDecision.newContext);

        const cleanLink = normalizeBBCLink(selected.link);
        STATE.bbc.seen[cleanLink] = Date.now();
        await saveState(STATE);
        return;
      }
    } catch (err) {
      console.warn(
        "⚠️ Context judge failed, proceeding without context dedup:",
        err.message
      );
    }

    let tweetBody;

    try {
      tweetBody = await generateBBCNewsTweet(parsed.body);

      if (!tweetBody || tweetBody.length < 30) {
        throw new Error("AI tweet too short");
      }
    } catch (err) {
      console.warn("⚠️ Tweet AI failed, using fallback:", err.message);
      tweetBody = generateBBCFallbackTweet(selected);
    }

    const cleanUrl = normalizeBBCLink(selected.link);
    const tweetText = `${tweetBody}\n\n[BBC Sport]`;

    let imageUrl = getBBCImageUrl(selected);
    imageUrl = upgradeBBCImage(imageUrl);
    console.log("imageUrl::", imageUrl);

    if (CONSOLE_ONLY) {
      console.log("🟡 CONSOLE MODE — Tweet skipped");
      console.log(tweetText);
    } else {
      try {
        if (imageUrl) {
          await tweetWithNativeImage({
            text: tweetText,
            imageUrl,
          });
        } else {
          await postTweet_bbc_web({ text: tweetText });
        }
      } catch (err) {
        console.warn(
          "⚠️ BBC image tweet failed, falling back to text-only:",
          err.message
        );
        await postTweet_bbc_web({ text: tweetText });
      }
    }

    STATE.bbc.seen[cleanUrl] = Date.now();
    STATE.bbc.lastPubMs = Math.max(
      STATE.bbc.lastPubMs || 0,
      getPubDate(selected)
    );
    STATE.bbc.lastLink = cleanUrl;
    STATE.bbc.lastTitle = selected.title;
    STATE.bbc.visibleDate = new Date(getPubDate(selected)).toUTCString();

    if (contextDecision?.newContext) {
      STATE.dailyContext.contexts.push({
        summary: contextDecision.newContext,
        source: "BBC",
        link: cleanUrl,
        createdAt: new Date().toISOString(),
      });
    }

    STATE.bbc = {
      lastPubMs: STATE.bbc.lastPubMs || 0,
      lastLink: STATE.bbc.lastLink || "",
      lastTitle: STATE.bbc.lastTitle || "",
      visibleDate: STATE.bbc.visibleDate || null,
      seen: STATE.bbc.seen || {},
    };

    STATE.dailyContext = {
      date: STATE.dailyContext.date,
      contexts: STATE.dailyContext.contexts || [],
    };

    await saveState(STATE);

    console.log("🟢 BBC state + dailyContext saved");
  } catch (err) {
    console.error("❌ ERROR in BBC polling:", err);
  }
}

function getPubDate(item) {
  const raw = item?.pubDate;
  return raw ? new Date(raw).getTime() : 0;
}

function normalizeBBCLink(link) {
  return link.split("?")[0].split("#")[0];
}

function getTodayUTC() {
  return new Date().toISOString().slice(0, 10);
}
