import { postTweet_ie_web } from "../twitter/twitter.js"; // consider renaming later
import { tweetWithNativeImage } from "../twitter/tweetWithImage.js";
import { saveState } from "../utils/stateStoreCloud.js";

import { fetchHinduCricketRSS } from "./hinduRssFetcher.js";
import { isHinduArticle, normalizeHinduLink } from "./hinduFilters.js";
import { fetchHinduArticle } from "./fetchHinduArticle.js";
import { parseHinduArticle } from "./parseHinduArticle.js";
import { getHinduImageUrl } from "./getHinduImage.js";

import { generateHinduFallbackTweet } from "./ai/generateHinduFallbackTweet.js";
import { judgeNewsContext } from "./ai/judgeNewsContext.js";
import { generateCommonStyleTweet } from "../twitter/generateCommonStyleTweet.js";

export async function hinduNewsPollingLoop() {
  if (!global.STATE) {
    console.log("⚠️ global.STATE not ready. Skipping Hindu polling.");
    return;
  }

  const STATE = global.STATE;

  // ── Init state ─────────────────────────────────────────────
  STATE.hindu ??= {};
  STATE.hindu.seen ??= {};

  const today = getTodayUTC();
  if (!STATE.dailyContext || STATE.dailyContext.date !== today) {
    STATE.dailyContext = {
      date: today,
      contexts: [],
    };
  }

  // ── Config ────────────────────────────────────────────────
  // const MAX_AGE_HOURS = 24;
  const MAX_AGE_MIN = 25;
  const SEEN_RETENTION_HOURS = 6;
  const CONSOLE_ONLY = process.env.CONSOLE_ONLY === "true";

  // const MAX_AGE_MS = MAX_AGE_HOURS * 60 * 60 * 1000;
  const SEEN_RETENTION_MS = SEEN_RETENTION_HOURS * 60 * 60 * 1000;

  try {
    // ── Prune seen cache ─────────────────────────────────────
    const now = Date.now();
    let pruned = 0;

    for (const [link, ts] of Object.entries(STATE.hindu.seen)) {
      if (now - ts > SEEN_RETENTION_MS) {
        delete STATE.hindu.seen[link];
        pruned++;
      }
    }

    if (pruned) {
      console.log(`🧹 Pruned ${pruned} old Hindu seen entries`);
    }

    // ── Fetch RSS ────────────────────────────────────────────
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
      const ageMin = (Date.now() - pubMs) / 60000;
      if (ageMin > MAX_AGE_MIN) continue;
      // if (Date.now() - pubMs > MAX_AGE_MS) continue;

      const cleanLink = normalizeHinduLink(item.link);
      if (STATE.hindu.seen[cleanLink]) continue;

      selected = item;
      break;
    }

    if (!selected) {
      console.log("🟡 No eligible Hindu articles");
      return;
    }

    // ── Fetch + parse ────────────────────────────────────────
    const html = await fetchHinduArticle(selected.link);
    const parsed = parseHinduArticle(html);

    if (!parsed?.body || parsed.body.length < 80) {
      console.warn("⚠️ Hindu article body too short");
      return;
    }

    // ── Context dedupe ───────────────────────────────────────
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
          "🔁 Hindu context already covered — skipping",
          STATE.dailyContext.contexts.map((c) => c.summary)
        );

        const cleanLink = normalizeHinduLink(selected.link);
        STATE.hindu.seen[cleanLink] = Date.now();
        STATE.hindu.lastLink = cleanLink;
        STATE.hindu.lastTitle = selected.title;
        STATE.hindu.visibleDate = new Date(getPubDate(selected)).toUTCString();

        await saveState(STATE);
        return;
      }
    } catch (err) {
      console.warn("⚠️ Context judge failed (Hindu), proceeding:", err.message);
    }

    // ── Generate tweet ───────────────────────────────────────
    let tweetBody;

    try {
      tweetBody = await generateCommonStyleTweet(
        parsed.headline + parsed.body,
        "The Hindu"
      );

      if (!tweetBody || tweetBody.length < 30) {
        throw new Error("AI output invalid");
      }
    } catch (err) {
      console.warn("⚠️ Hindu AI failed, using fallback:", err.message);
      tweetBody = generateHinduFallbackTweet(selected);
    }

    const cleanUrl = normalizeHinduLink(selected.link);
    const imageUrl = getHinduImageUrl(selected);

    // 🟢 Hindu source signature
    let tweetText = `🟢 ${tweetBody}`;

    // ── Post tweet ───────────────────────────────────────────
    if (CONSOLE_ONLY) {
      console.log("🟡 CONSOLE MODE — Tweet skipped");
      console.log(tweetText);
    } else {
      try {
        if (imageUrl) {
          await tweetWithNativeImage({ text: tweetText, imageUrl });
        } else {
          await postTweet_ie_web({ text: tweetText });
        }
      } catch (err) {
        console.warn(
          "⚠️ Hindu image tweet failed, fallback to text-only:",
          err.message
        );
        await postTweet_ie_web({ text: tweetText });
      }
    }

    // ── Update state ─────────────────────────────────────────
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

    await saveState(STATE);
    console.log("🟢 Hindu state + dailyContext saved");
  } catch (err) {
    console.error("❌ ERROR in Hindu polling:", err);
  }
}

// ── Helpers ────────────────────────────────────────────────
function getPubDate(item) {
  return item?.pubDate ? new Date(item.pubDate).getTime() : 0;
}

function getTodayUTC() {
  return new Date().toISOString().slice(0, 10);
}
