// hinduNewsPollingLoop.js
//
// Aligned with CB / CA / ESPN:
//  - GPT classify + GPT judge (a dropped article never costs a Claude call)
//  - POST_VIA_API flag: true  = score >= 7 -> X API, score < 7 -> WhatsApp
//                       false = score >= 7 -> WhatsApp, score < 7 dropped
//  - Claude tweet (with SOURCE + long-tweet flag), GPT fallback
//  - applySourceSignature, same score / virality logging

import { saveState } from "../utils/stateStoreCloud.js";

import { fetchHinduArticle } from "./fetchHinduArticle.js";
import { getHinduImageUrl } from "./getHinduImage.js";
import { isHinduArticle, normalizeHinduLink } from "./hinduFilters.js";
import { fetchHinduCricketRSS } from "./hinduRssFetcher.js";
import { parseHinduArticle } from "./parseHinduArticle.js";

import {
  classifyArticleGPT,
  generateGPTTweetWithType,
} from "../ai/generate-gpt-tweet.js";
import {
  generateClaudeTweetWithType,
  isLongTweetEligible,
  SIGNIFICANCE_EXEMPT_TYPES,
} from "../ai/generateClaudeTweet.js";
import { judgeNewsContextGPT } from "../ai/judgeNewsContextGPT.js";
import { normalizeHinduImageUrl } from "../indian-express/ai/imageDetector.js";
import { applySourceSignature, enqueueTweet } from "../twitter/tweetQueue.js";
import { sendTweetDraftToWhatsApp } from "../utils/whatsappSender.js";

const SOURCE = "HINDU";
const MAX_AGE_MIN = 60;
const SEEN_RETENTION_MS = 6 * 60 * 60 * 1000; // 6 hours
// const CONTEXT_RETENTION_MS = 6 * 60 * 60 * 1000;
const CONTEXT_RETENTION_MS =
  (Number(process.env.CONTEXT_TTL_HOURS) > 0
    ? Number(process.env.CONTEXT_TTL_HOURS)
    : 6) *
  60 *
  60 *
  1000; // dailyContext prune window
const CONSOLE_ONLY = process.env.CONSOLE_ONLY === "true";

// true  = score >= 7 -> X API, score < 7 -> WhatsApp (current flow)
// false = score >= 7 -> WhatsApp, score < 7 dropped (cutover; you post manually)
const POST_VIA_API = process.env.POST_VIA_API !== "false";

export async function hinduNewsPollingLoop() {
  if (!global.STATE) {
    console.log("⚠️ global.STATE not ready. Skipping Hindu polling.");
    return;
  }

  const STATE = global.STATE;

  STATE.hindu ??= {};
  STATE.hindu.seen ??= {};

  // Shared with CA / NDTV / CB for cross-source duplicate detection. Do NOT
  // reset it on a date change (that wipes the other sources' contexts) —
  // prune by age instead, same contract as CA / NDTV.
  STATE.dailyContext ??= { contexts: [] };
  STATE.dailyContext.contexts ??= [];

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

    pruneDailyContext(STATE, CONTEXT_RETENTION_MS);

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

    const cleanLink = normalizeHinduLink(selected.link);

    const markSeen = () => {
      STATE.hindu.seen[cleanLink] = Date.now();
      STATE.hindu.lastLink = cleanLink;
      STATE.hindu.lastTitle = selected.title;
      STATE.hindu.visibleDate = new Date(getPubDate(selected)).toUTCString();
    };

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
      articleType = await classifyArticleGPT(fullText);
      console.log(`🏷️ Classified as: ${articleType}`);
    } catch (err) {
      try {
        articleType = await classifyArticleGPT(fullText);
      } catch (err2) {
        console.warn(
          "⚠️ Hindu classify failed twice, using default:",
          err2?.message,
        );
      }
    }

    // ── Step 2: Deduplication + significance gate ─────────────────────────────
    const existingContexts = STATE.dailyContext.contexts.map((c) => c.summary);

    let decision = null;
    try {
      decision = await judgeNewsContextGPT({
        articleText: fullText,
        existingContexts,
      });
    } catch (err) {
      try {
        decision = await judgeNewsContextGPT({
          articleText: fullText,
          existingContexts,
        });
      } catch (err2) {}
    }

    if (!decision) {
      // Not marked seen — retried on the next poll (article is < 60 min old).
      console.log(
        "⚠️ Hindu judge failed twice, skipping for now:",
        selected.title,
      );
      return;
    }

    if (decision?.isAlreadyCovered === true && decision?.confidence >= 0.8) {
      console.log("🔁 Hindu context already covered — skipping");
      markSeen();
      await saveState(STATE);
      return;
    }

    const isExempt = SIGNIFICANCE_EXEMPT_TYPES.has(articleType);
    const score = decision?.significanceScore ?? 10;
    const vScore = decision?.viralityScore ?? "n/a";

    const isLowScore = !isExempt && score < 7;
    const sendViaWhatsApp = !POST_VIA_API || isLowScore;

    if (isLowScore && !POST_VIA_API) {
      markSeen();

      console.log(`🗂️ ARTICLE TYPE :: ${articleType}`);
      console.log(`📊 SIGNIFICANCE SCORE :: ${score} VIRALITY :: ${vScore}`);
      console.log(`📰 TWEET HEADLINE :: ${selected.title}`);
      console.log("🔴 HINDU ARTICLE SCORE IS TOO LOW");
      console.log("===========================================");

      await saveState(STATE, "low significance skipped");
      return;
    }

    if (isLowScore) {
      console.log(`📊 SIGNIFICANCE SCORE :: ${score} VIRALITY :: ${vScore}`);
      console.log(`📰 TWEET HEADLINE :: ${selected.title}`);
      console.log("📲 HINDU score < 7 — sending to WhatsApp, not X API");
    }

    if (!isExempt) {
      console.log(`✅ Significance: ${score}/10 — proceeding`);
    }

    // ── Step 3: Tweet generation ──────────────────────────────────────────────
    const longEligible = isLongTweetEligible(fullText);

    if (longEligible) {
      console.log("📏 Hindu article qualifies for long-tweet mode");
    }

    let tweetText = null;
    let model = "claude";

    try {
      const result = await generateClaudeTweetWithType(
        fullText,
        articleType,
        SOURCE,
        longEligible,
      );
      tweetText = result?.tweetText;
    } catch (err) {
      console.warn("⚠️ Claude failed:", err?.message || err);
    }

    if (!tweetText || tweetText.trim().length < 30) {
      try {
        const result = await generateGPTTweetWithType(
          fullText,
          articleType,
          SOURCE,
          longEligible,
        );
        tweetText = result?.tweetText;
        model = "GPT";
      } catch (err) {
        console.warn(
          "⚠️ Hindu AI failed, skipping tweet:",
          err?.message || err,
        );
        return;
      }
    }

    if (!tweetText || tweetText.trim().length < 30) {
      console.warn("⚠️ Hindu tweet generation failed / too short");
      markSeen();
      await saveState(STATE);
      return;
    }

    tweetText = applySourceSignature(tweetText, SOURCE);

    // ── Step 4: Deliver (WhatsApp draft or X API queue) ──────────────────────
    if (CONSOLE_ONLY) {
      console.log("tweetText::", tweetText);
      console.log("🧪 CONSOLE_ONLY mode. Not sending / enqueueing.");
      return;
    }

    if (sendViaWhatsApp) {
      await sendTweetDraftToWhatsApp({
        source: SOURCE,
        headline: selected.title,
        tweetText,
        articleUrl: cleanLink,
      });
    } else {
      let imageUrl = getHinduImageUrl(selected);
      imageUrl = normalizeHinduImageUrl(imageUrl);

      enqueueTweet({
        id: `HINDU:${cleanLink}`,
        source: SOURCE,
        text: tweetText,
        imageUrl,
        seenKey: cleanLink,
        headline: selected.title,
        model,
        articleType,
        score,
      });

      console.log(`📥 Queued HINDU tweet: ${selected.title}`);
    }

    markSeen();
    STATE.hindu.lastPubMs = Math.max(
      STATE.hindu.lastPubMs || 0,
      getPubDate(selected),
    );

    if (!isLowScore && decision?.newContext) {
      STATE.dailyContext.contexts.push({
        summary: decision.newContext,
        source: SOURCE,
        link: cleanLink,
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

function pruneDailyContext(STATE, retentionMs) {
  try {
    const ctx = STATE.dailyContext?.contexts;
    if (!Array.isArray(ctx) || ctx.length === 0) return;

    const now = Date.now();
    STATE.dailyContext.contexts = ctx.filter((c) => {
      const t = new Date(c.createdAt).getTime();
      return Number.isFinite(t) && now - t <= retentionMs;
    });
  } catch (err) {
    console.warn("⚠️ dailyContext prune failed:", err?.message || err);
  }
}
