// hinduNewsPollingLoop.js

import { saveState } from "../utils/stateStoreCloud.js";

import { fetchHinduArticle } from "./fetchHinduArticle.js";
import { getHinduImageUrl } from "./getHinduImage.js";
import { isHinduArticle, normalizeHinduLink } from "./hinduFilters.js";
import { fetchHinduCricketRSS } from "./hinduRssFetcher.js";
import { parseHinduArticle } from "./parseHinduArticle.js";

import { generateGeminiTweet } from "../ai/generate-gemini-tweet.js";
import {
  classifyArticle,
  generateClaudeTweetWithType,
  SIGNIFICANCE_EXEMPT_TYPES,
} from "../ai/generateClaudeTweet.js";
import { normalizeHinduImageUrl } from "../indian-express/ai/imageDetector.js";
import { enqueueTweet } from "../twitter/tweetQueue.js";
import { judgeNewsContext } from "../indian-express/ai/judgeNewsContext.js";

const MAX_AGE_MIN = 60;
const SEEN_RETENTION_MS = 6 * 60 * 60 * 1000; // 6 hours
const CONSOLE_ONLY = process.env.CONSOLE_ONLY === "true";

export async function hinduNewsPollingLoop() {
  if (!global.STATE) {
    console.log("⚠️ global.STATE not ready. Skipping Hindu polling.");
    return;
  }

  const STATE = global.STATE;

  STATE.hindu ??= {};
  STATE.hindu.seen ??= {};

  const today = getTodayUTC();
  if (!STATE.dailyContext || STATE.dailyContext.date !== today) {
    STATE.dailyContext = { date: today, contexts: [] };
  }

  try {
    // ── Prune stale seen entries ──────────────────────────────────────────────
    const now = Date.now();
    let pruned = 0;

    for (const [link, ts] of Object.entries(STATE.hindu.seen)) {
      if (now - ts > SEEN_RETENTION_MS) {
        delete STATE.hindu.seen[link];
        pruned++;
      }
    }

    if (pruned) console.log(`🧹 Pruned ${pruned} old Hindu seen entries`);

    // ── Fetch + filter RSS ────────────────────────────────────────────────────
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

      const cleanLink = normalizeHinduLink(item.link);
      if (STATE.hindu.seen[cleanLink]) continue;

      selected = item;
      break;
    }

    if (!selected) {
      console.log("🟡 No eligible Hindu articles");
      return;
    }

    // ── Fetch article body ────────────────────────────────────────────────────
    const html = await fetchHinduArticle(selected.link);
    const parsed = parseHinduArticle(html);

    if (!parsed?.body || parsed.body.length < 80) {
      console.warn("⚠️ Hindu article body too short");
      return;
    }

    const fullText = `${parsed.headline}\n${parsed.body}`;

    // ── Step 1: Classify article type first ──────────────────────────────────
    let articleType = "player_form";
    try {
      articleType = await classifyArticle(fullText);
      console.log(`🏷️ Classified as: ${articleType}`);
    } catch (err) {
      console.warn("⚠️ classifyArticle failed, using default:", err?.message);
    }

    // ── Step 2: Deduplication + significance gate ─────────────────────────────
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
        console.log("🔁 Hindu context already covered — skipping");
        const cleanLink = normalizeHinduLink(selected.link);
        STATE.hindu.seen[cleanLink] = Date.now();
        STATE.hindu.lastLink = cleanLink;
        STATE.hindu.lastTitle = selected.title;
        STATE.hindu.visibleDate = new Date(getPubDate(selected)).toUTCString();
        await saveState(STATE);
        return;
      }

      const isExempt = SIGNIFICANCE_EXEMPT_TYPES.has(articleType);
      const score = contextDecision?.significanceScore ?? 10;

      if (!isExempt && score < 7) {
        console.log(
          `⬇️ Low significance (${score}/10) — skipping: ${selected.title}`,
        );
        const cleanLink = normalizeHinduLink(selected.link);
        STATE.hindu.seen[cleanLink] = Date.now();
        STATE.hindu.lastLink = cleanLink;
        STATE.hindu.lastTitle = selected.title;
        STATE.hindu.visibleDate = new Date(getPubDate(selected)).toUTCString();
        await saveState(STATE);
        return;
      }

      if (isExempt) {
        console.log(
          `🌟 Exempt type (${articleType}) — bypassing significance gate (score: ${score}/10)`,
        );
      } else {
        console.log(`✅ Significance: ${score}/10 — proceeding`);
      }
    } catch (err) {
      console.warn("⚠️ Context judge failed (Hindu), proceeding:", err.message);
    }

    // ── Step 3: Tweet generation ──────────────────────────────────────────────
    let tweetText = null;
    try {
      const result = await generateClaudeTweetWithType(fullText, articleType);
      tweetText = result.tweetText;
      console.log("Prompt generated by claude ....");
    } catch (err) {
      console.warn("⚠️ Claude failed:", err?.message || err);
    }

    if (!tweetText || tweetText.trim().length < 30) {
      try {
        tweetText = await generateGeminiTweet(fullText);
        console.log("Prompt generated by Gemini ....");
      } catch (err) {
        console.warn("⚠️ Gemini failed:", err?.message || err);
      }
    }

    if (!tweetText || tweetText.trim().length < 30) {
      console.warn("⚠️ Hindu AI failed, skipping tweet");
      return;
    }

    // ── Enqueue ───────────────────────────────────────────────────────────────
    const cleanUrl = normalizeHinduLink(selected.link);
    let imageUrl = getHinduImageUrl(selected);
    imageUrl = normalizeHinduImageUrl(imageUrl);

    const tweetId = `HINDU:${cleanUrl}`;

    if (CONSOLE_ONLY) {
      console.log("tweetText::", tweetText);
      console.log("🧪 CONSOLE_ONLY mode. Not enqueueing.");
      return;
    }

    enqueueTweet({
      id: tweetId,
      source: "HINDU",
      text: tweetText,
      imageUrl,
      seenKey: cleanUrl,
    });

    console.log(`📥 Queued HINDU tweet: ${selected.title}`);

    STATE.hindu.seen[cleanUrl] = Date.now();
    STATE.hindu.lastPubMs = Math.max(
      STATE.hindu.lastPubMs || 0,
      getPubDate(selected),
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

function getPubDate(item) {
  return item?.pubDate ? new Date(item.pubDate).getTime() : 0;
}

function getTodayUTC() {
  return new Date().toISOString().slice(0, 10);
}
