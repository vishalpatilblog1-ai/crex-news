import { postTweet_ie_web } from "../twitter/twitter.js"; // consider renaming later
import { saveState } from "../utils/stateStoreCloud.js";

import { fetchHinduCricketRSS } from "./hinduRssFetcher.js";
import { isHinduArticle, normalizeHinduLink } from "./hinduFilters.js";
import { fetchHinduArticle } from "./fetchHinduArticle.js";
import { parseHinduArticle } from "./parseHinduArticle.js";

import { generateHinduNewsTweet } from "./ai/generateHinduNewsTweet.js";
import { generateHinduFallbackTweet } from "./ai/generateHinduFallbackTweet.js";
import { judgeNewsContext } from "./ai/judgeNewsContext.js";
import { tweetWithNativeImage } from "../twitter/tweetWithImage.js";
import { getHinduImageUrl } from "./getHinduImage.js";

export async function hinduNewsPollingLoop() {
  if (!global.STATE) return;

  const STATE = global.STATE;

  if (!STATE.hindu) STATE.hindu = {};
  if (!STATE.hindu.seen) STATE.hindu.seen = {};
  if (!STATE.hindu.lastPubMs) STATE.hindu.lastPubMs = 0;

  const TWEET_MAX_AGE_HOURS = Number(process.env.BBC_MAX_AGE_HOURS || 24);
  const SEEN_RETENTION_HOURS = Number(
    process.env.BBC_SEEN_RETENTION_HOURS || 48
  );
  const CONSOLE_ONLY = process.env.CONSOLE_ONLY === "true";

  const TWEET_MAX_AGE_MS = TWEET_MAX_AGE_HOURS * 60 * 60 * 1000;
  const SEEN_RETENTION_MS = SEEN_RETENTION_HOURS * 60 * 60 * 1000;

  // 🔒 Fail-safe dailyContext (index.js owns reset)
  if (!STATE.dailyContext || !Array.isArray(STATE.dailyContext.contexts)) {
    STATE.dailyContext = {
      date: getTodayUTC(),
      contexts: [],
    };
  }

  try {
    const now = Date.now();
    let pruned = 0;

    for (const [link, ts] of Object.entries(STATE.hindu.seen)) {
      if (now - ts > SEEN_RETENTION_MS) {
        delete STATE.hindu.seen[link];
        pruned++;
      }
    }

    if (pruned > 0) {
      console.log(`🧹 Pruned ${pruned} old Hindu seen entries`);
    }
    // 📰 Fetch RSS
    const items = await fetchHinduCricketRSS();
    if (!Array.isArray(items) || items.length === 0) {
      console.log("ℹ️ No Hindu RSS items");
      return;
    }

    const sorted = items
      .filter(isHinduArticle)
      .sort((a, b) => getPubDate(b) - getPubDate(a));

    let selected = null;

    for (const item of sorted) {
      const pubMs = getPubDate(item);
      if (!pubMs) continue;
      if (Date.now() - pubMs > TWEET_MAX_AGE_MS) continue;

      const cleanLink = normalizeHinduLink(item.link);
      if (STATE.hindu.seen[cleanLink]) continue;

      selected = item;
      break;
    }

    if (!selected) {
      console.log("🟡 No eligible Hindu articles");
      return;
    }

    const html = await fetchHinduArticle(selected.link);
    const parsed = parseHinduArticle(html);

    if (!parsed?.body || parsed.body.length < 80) {
      console.warn("⚠️ Hindu article body too short");
      return;
    }

    // 🧠 Context judge
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
        console.log(
          "🔁 Hindu context already covered — skipping- existingContexts::",
          existingContexts
        );

        STATE.hindu.seen[normalizeHinduLink(selected.link)] = Date.now();
        await saveState(STATE);
        return;
      }
    } catch (err) {
      console.warn("⚠️ Context judge failed (Hindu), proceeding:", err.message);
    }

    // ✍️ Tweet generation
    let tweetBody;
    try {
      tweetBody = await generateHinduNewsTweet(parsed.body);
      if (!tweetBody || tweetBody.length < 30) {
        throw new Error("AI output invalid");
      }
    } catch (err) {
      console.warn("⚠️ Hindu AI failed:", err.message);
      tweetBody = generateHinduFallbackTweet(selected);
    }

    const cleanUrl = normalizeHinduLink(selected.link);

    const tweetText = `${tweetBody}\n\n[The Hindu]`;
    const imageUrl = getHinduImageUrl(selected);

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
          // rare edge case: no image
          await postTweet_ie_web({ text: tweetText });
        }
      } catch (err) {
        console.warn(
          "⚠️ Hindu image tweet failed, falling back to text-only:",
          err.message
        );
        await postTweet_ie_web({ text: tweetText });
      }
    }

    STATE.hindu.seen[cleanUrl] = Date.now();
    STATE.hindu.lastPubMs = Math.max(
      STATE.hindu.lastPubMs || 0,
      getPubDate(selected)
    );
    STATE.hindu.lastLink = cleanUrl;
    STATE.hindu.lastTitle = selected.title;
    STATE.hindu.visibleDate = new Date(getPubDate(selected)).toUTCString();

    if (contextDecision?.newContext) {
      STATE.dailyContext.contexts.push({
        summary: contextDecision.newContext,
        source: "HINDU",
        link: cleanUrl,
        createdAt: new Date().toISOString(),
      });
    }

    STATE.hindu = {
      lastPubMs: STATE.hindu?.lastPubMs || 0,
      lastLink: STATE.hindu?.lastLink || "",
      lastTitle: STATE.hindu?.lastTitle || "",
      visibleDate: STATE.hindu?.visibleDate || null,
      seen: STATE.hindu?.seen || {},
    };

    STATE.dailyContext = {
      date: STATE.dailyContext.date,
      contexts: STATE.dailyContext.contexts || [],
    };

    await saveState(STATE);
    console.log("🟢 Hindu state + dailyContext saved");
  } catch (err) {
    console.error("❌ ERROR in Hindu polling:", err);
  }
}

function getPubDate(item) {
  const raw = item?.pubDate;
  return raw ? new Date(raw).getTime() : 0;
}

function getTodayUTC() {
  return new Date().toISOString().slice(0, 10);
}
