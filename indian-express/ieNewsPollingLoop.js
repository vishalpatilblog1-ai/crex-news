// ieNewsPollingLoop.js
//
// Aligned with CB / CA / ESPN:
//  - GPT classify + GPT judge (a dropped article never costs a Claude call)
//  - POST_VIA_API flag: true  = score >= 7 -> X API, score < 7 -> WhatsApp
//                       false = score >= 7 -> WhatsApp, score < 7 dropped
//  - Claude tweet (with SOURCE + long-tweet flag), GPT fallback
//  - applySourceSignature, same score / virality logging
//
// The IE card image is only generated when the tweet goes to the X API queue.
// WhatsApp drafts are text only (same as CB / CA / ESPN).

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
import { generateCardImage } from "../canvas/imageRenderer.js";
import { applySourceSignature, enqueueTweet } from "../twitter/tweetQueue.js";
import { CREX_BASE_IMAGE_TEMPLATE_NEW } from "../utils/config.js";
import { saveState } from "../utils/stateStoreCloud.js";
import { sendTweetDraftToWhatsApp } from "../utils/whatsappSender.js";

import { fetchIEArticle } from "./fetchIEArticle.js";
import { isIEArticle, normalizeIELink } from "./ieFilters.js";
import { fetchIECricketRSS } from "./ieRssFetcher.js";
import { parseIEArticle } from "./parseIEArticle.js";

const SOURCE = "IE";
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

export async function ieNewsPollingLoop() {
  if (!global.STATE) {
    console.log("⚠️ global.STATE not ready. Skipping IE polling.");
    return;
  }

  const STATE = global.STATE;

  STATE.ie ??= {};
  STATE.ie.seen ??= {};

  // Shared with CA / NDTV / CB for cross-source duplicate detection. Do NOT
  // reset it on a date change (that wipes the other sources' contexts) —
  // prune by age instead, same contract as CA / NDTV.
  STATE.dailyContext ??= { contexts: [] };
  STATE.dailyContext.contexts ??= [];

  try {
    // ── Prune stale seen entries ──────────────────────────────────────────────
    const now = Date.now();
    let pruned = 0;

    for (const [link, ts] of Object.entries(STATE.ie.seen)) {
      if (now - ts > SEEN_RETENTION_MS) {
        delete STATE.ie.seen[link];
        pruned++;
      }
    }

    if (pruned) console.log(`🧹 Pruned ${pruned} old IE seen entries`);

    pruneDailyContext(STATE, CONTEXT_RETENTION_MS);

    // ── Fetch + filter RSS ────────────────────────────────────────────────────
    const items = await fetchIECricketRSS();
    if (!Array.isArray(items) || items.length === 0) {
      console.log("ℹ️ No IE RSS items");
      return;
    }

    const sorted = items
      .filter(isIEArticle)
      .sort((a, b) => getPubDate(b) - getPubDate(a));

    let selected = null;

    for (const item of sorted) {
      const pubMs = getPubDate(item);
      if (!pubMs) continue;

      const ageMin = (Date.now() - pubMs) / 60000;
      if (ageMin > MAX_AGE_MIN) continue;

      const cleanLink = normalizeIELink(item.link);
      if (STATE.ie.seen[cleanLink]) continue;

      selected = item;
      break;
    }

    if (!selected) {
      // console.log("🟡 No eligible IE articles (age + dedupe)");
      return;
    }

    console.log(
      "🆕 IE news detected:",
      selected.title,
      "| pubDate:",
      selected.pubDate,
    );

    const cleanUrl = normalizeIELink(selected.link);

    const markSeen = () => {
      STATE.ie.seen[cleanUrl] = Date.now();
      STATE.ie.lastLink = cleanUrl;
      STATE.ie.lastTitle = selected.title;
      STATE.ie.visibleDate = new Date(getPubDate(selected)).toUTCString();
    };

    // ── Fetch article body ────────────────────────────────────────────────────
    const html = await fetchIEArticle(selected.link);
    const parsed = parseIEArticle(html);

    if (!parsed?.body || parsed.body.length < 80) {
      console.warn("⚠️ IE article body missing / too short");
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
          "⚠️ IE classify failed twice, using default:",
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
        "⚠️ IE judge failed twice, skipping for now:",
        selected.title,
      );
      return;
    }

    if (decision?.isAlreadyCovered === true && decision?.confidence >= 0.8) {
      console.log("🔁 IE context already covered — skipping");
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
      console.log("🔴 IE ARTICLE SCORE IS TOO LOW");
      console.log("===========================================");

      await saveState(STATE, "low significance skipped");
      return;
    }

    if (isLowScore) {
      console.log(`📊 SIGNIFICANCE SCORE :: ${score} VIRALITY :: ${vScore}`);
      console.log(`📰 TWEET HEADLINE :: ${selected.title}`);
      console.log("📲 IE score < 7 — sending to WhatsApp, not X API");
    }

    if (!isExempt) {
      console.log(`✅ Significance: ${score}/10 — proceeding`);
    }

    // ── Step 3: Tweet generation ──────────────────────────────────────────────
    const longEligible = isLongTweetEligible(fullText);

    if (longEligible) {
      console.log("📏 IE article qualifies for long-tweet mode");
    }

    let tweetText = null;
    let card = null;
    let model = "claude";

    try {
      const result = await generateClaudeTweetWithType(
        fullText,
        articleType,
        SOURCE,
        longEligible,
      );
      tweetText = result?.tweetText;
      card = result?.card ?? null;
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
        card = null; // card layout is only trusted from the Claude path
        model = "GPT";
      } catch (err) {
        console.warn("⚠️ IE AI failed, skipping tweet:", err?.message || err);
        return;
      }
    }

    if (!tweetText || tweetText.trim().length < 30) {
      console.warn("⚠️ IE tweet generation failed / too short");
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
        articleUrl: cleanUrl,
        articleType,
        score,
        virality: vScore,
      });
    } else {
      let generatedPath = null;

      if (card) {
        try {
          generatedPath = await generateCardImage(
            CREX_BASE_IMAGE_TEMPLATE_NEW,
            card,
          );
        } catch (err) {
          console.error("❌ Image generation failed:", err);
        }
      } else {
        console.log("📝 Text-only tweet (no card)");
      }

      enqueueTweet({
        id: `IE:${cleanUrl}`,
        source: SOURCE,
        text: tweetText,
        imageUrl: generatedPath || null,
        seenKey: cleanUrl,
        headline: selected.title,
        model,
        articleType,
        score,
      });

      console.log(`📥 Queued IE tweet: ${selected.title}`);
    }

    markSeen();

    if (!isLowScore && decision?.newContext) {
      STATE.dailyContext.contexts.push({
        summary: decision.newContext,
        source: SOURCE,
        link: cleanUrl,
        createdAt: new Date().toISOString(),
      });
    }

    await saveState(STATE);
    console.log("🟢 IE state + dailyContext saved");
  } catch (err) {
    console.error("❌ ERROR in IE polling:", err);
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
