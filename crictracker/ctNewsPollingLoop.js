// crictracker/ctNewsPollingLoop.js
//
// Aligned with CB / CA / ESPN / NDTV / Hindu / IE / SK:
//  - GPT classify + GPT judge (a dropped article never costs a Claude call)
//  - POST_VIA_API flag: true  = score >= 7 -> X API, score < 7 -> WhatsApp
//                       false = score >= 7 -> WhatsApp, score < 7 dropped
//  - Claude tweet (with SOURCE + long-tweet flag), GPT fallback
//  - applySourceSignature, same score / virality logging
//
// The old card-image generation is gone: its result was never used
// (imageUrl was already forced to null on enqueue). The article-image OCR
// bookkeeping only runs on the X API path.

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
import { saveState } from "../utils/stateStoreCloud.js";

import { isBlockedCAHeadline } from "../cricket-addictor/caHeadlineFilter.js";
import { isCTArticle, normalizeCTLink } from "./ctFilters.js";
import { fetchCTRSS } from "./fetchCTRSS.js";
import { parseCTArticle } from "./parseCTArticle.js";

import { isRiskyTwitterImage } from "../cricket-addictor/ocr/detectTwitterReference.js";
import { downloadImageToTemp } from "../cricket-addictor/ocr/downloadImageToTemp.js";
import { getCACTImageUrl } from "../common/getCACTImageUrl.js";
import { applySourceSignature, enqueueTweet } from "../twitter/tweetQueue.js";
import { sendTweetDraftToWhatsApp } from "../utils/whatsappSender.js";

const SOURCE = "CT";
const MAX_AGE_MIN = 120;
const RETENTION_MS = 6 * 60 * 60 * 1000; // seen + usedImages prune window
// How long the shared "already covered" story memory lasts (hours, from env; default 6).
const CONTEXT_TTL_MS =
  (Number(process.env.CONTEXT_TTL_HOURS) > 0
    ? Number(process.env.CONTEXT_TTL_HOURS)
    : 6) *
  60 *
  60 *
  1000;
const MAX_PER_POLL = 5; // cap how many tweets can queue / be sent in a single poll cycle

// true  = score >= 7 -> X API, score < 7 -> WhatsApp (current flow)
// false = score >= 7 -> WhatsApp, score < 7 dropped (cutover; you post manually)
const POST_VIA_API = process.env.POST_VIA_API !== "false";

export async function ctNewsPollingLoop() {
  if (!global.STATE) return false;

  const STATE = global.STATE;

  STATE.cricktracker ??= {};
  STATE.cricktracker.seen ??= {};
  STATE.dailyContext ??= { contexts: [] };
  STATE.usedImages ??= {};

  // ── Prune state ───────────────────────────────────────────────────────────
  let stateDirty = false;
  stateDirty ||= pruneCTSeen(STATE, RETENTION_MS);
  stateDirty ||= pruneDailyContext(STATE, CONTEXT_TTL_MS);
  stateDirty ||= pruneUsedImages(STATE, RETENTION_MS);

  if (stateDirty) {
    await saveState(STATE);
  }

  // ── Fetch RSS ─────────────────────────────────────────────────────────────
  let items;
  try {
    items = await fetchCTRSS();
  } catch (err) {
    console.warn("⚠️ CT RSS fetch failed:", err?.message || err);
    return false;
  }

  if (!Array.isArray(items) || items.length === 0) return false;

  const sorted = items
    .filter(isCTArticle)
    .sort((a, b) => getPubDate(b) - getPubDate(a));

  // ---- Collect ALL unseen, non-aged-out candidates (not just the first) ----
  const candidates = [];
  for (const item of sorted) {
    const pubMs = getPubDate(item);
    if (!pubMs) continue;

    const ageMin = (Date.now() - pubMs) / 60000;
    if (ageMin > MAX_AGE_MIN) {
      continue;
    }

    const cleanLink = normalizeCTLink(item.link);
    if (!cleanLink) continue;

    if (STATE.cricktracker.seen[cleanLink]) continue;

    if (isBlockedCAHeadline(item.title)) {
      STATE.cricktracker.seen[cleanLink] = Date.now();
      continue;
    }

    candidates.push({ item, cleanLink });
  }

  if (candidates.length === 0) {
    await saveState(STATE);
    return false;
  }

  let queuedCount = 0;

  // ---- Process every candidate (up to MAX_PER_POLL) ----
  for (const { item: selected, cleanLink } of candidates) {
    if (queuedCount >= MAX_PER_POLL) {
      console.log(
        `⏸️ CT hit MAX_PER_POLL (${MAX_PER_POLL}) — remaining stay unseen for next poll`,
      );
      break;
    }

    // ── Parse ─────────────────────────────────────────────────────────────
    const parsed = parseCTArticle(selected);
    if (!parsed?.body || parsed.body.length < 80) {
      STATE.cricktracker.seen[cleanLink] = Date.now();
      continue;
    }

    const fullText = `${parsed.headline}\n${parsed.body} ${JSON.stringify(
      parsed.table,
    )}`;

    // ── Step 1: classify ──────────────────────────────────────────────────
    let articleType = "player_form";
    try {
      articleType = await classifyArticleGPT(fullText);
    } catch (err) {
      try {
        articleType = await classifyArticleGPT(fullText);
      } catch (err2) {
        console.warn(
          "⚠️ CT classify failed twice, using default:",
          err2?.message,
        );
      }
    }

    // ── Step 2: dedup + significance gate ─────────────────────────────────
    const existingContexts =
      STATE.dailyContext?.contexts?.map((c) => c.summary) || [];

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
      // Not marked seen — retried on the next poll.
      console.log(
        "⚠️ CT judge failed twice, skipping for now:",
        parsed.headline,
      );
      continue;
    }

    if (decision?.isAlreadyCovered && decision?.confidence >= 0.8) {
      console.log("🔴 CT skipped — already covered context::", parsed.headline);
      STATE.cricktracker.seen[cleanLink] = Date.now();
      continue;
    }

    const isExempt = SIGNIFICANCE_EXEMPT_TYPES.has(articleType);
    const score = decision?.significanceScore ?? 10;
    const vScore = decision?.viralityScore ?? "n/a";

    const isLowScore = !isExempt && score < 7;
    const sendViaWhatsApp = !POST_VIA_API || isLowScore;

    if (isLowScore && !POST_VIA_API) {
      STATE.cricktracker.seen[cleanLink] = Date.now();

      console.log(`🗂️ ARTICLE TYPE :: ${articleType}`);
      console.log(`📊 SIGNIFICANCE SCORE :: ${score} VIRALITY :: ${vScore}`);
      console.log(`📰 TWEET HEADLINE :: ${parsed.headline}`);
      console.log("🔴 CT ARTICLE SCORE IS TOO LOW");
      console.log("===========================================");

      await saveState(STATE, "low significance skipped");
      continue;
    }

    if (isLowScore) {
      console.log(`📊 SIGNIFICANCE SCORE :: ${score} VIRALITY :: ${vScore}`);
      console.log(`📰 TWEET HEADLINE :: ${parsed.headline}`);
      console.log("📲 CT score < 7 — sending to WhatsApp, not X API");
    }

    if (!isExempt) {
      console.log(`✅ Significance: ${score}/10 — proceeding`);
    }

    // ── Step 3: tweet generation ──────────────────────────────────────────
    const longEligible = isLongTweetEligible(fullText);

    if (longEligible) {
      console.log("📏 CT article qualifies for long-tweet mode");
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
        console.warn("⚠️ CT AI failed, skipping tweet:", err?.message || err);
        continue;
      }
    }

    if (!tweetText || tweetText.trim().length < 30) {
      console.warn("⚠️ CT tweet generation failed / too short");
      STATE.cricktracker.seen[cleanLink] = Date.now();
      continue;
    }

    tweetText = applySourceSignature(tweetText, SOURCE);

    // ── Step 4: deliver (WhatsApp draft or X API queue) ───────────────────
    if (sendViaWhatsApp) {
      await sendTweetDraftToWhatsApp({
        source: SOURCE,
        headline: parsed.headline,
        tweetText,
        articleUrl: cleanLink,
      });
    } else {
      // Article-image bookkeeping is only needed on the X API path.
      const imageUrl = getCACTImageUrl(selected);
      const { useImage } = await decideImageUsage({
        imageUrl,
        usedImages: STATE.usedImages,
      });

      enqueueTweet({
        id: `CT:${cleanLink}`,
        source: SOURCE,
        text: tweetText,
        imageUrl: null,
        seenKey: cleanLink,
        headline: parsed.headline,
        model,
        articleType,
        score,
      });

      console.log(`📥 TWEET HEADLINE: ${parsed.headline}`);

      if (useImage && imageUrl) {
        STATE.usedImages[imageUrl] = Date.now();
      }
    }

    STATE.cricktracker.seen[cleanLink] = Date.now();
    // Counts WhatsApp sends too, so MAX_PER_POLL also caps a draft burst.
    queuedCount++;

    if (
      !isLowScore &&
      decision?.newContext &&
      !contextExists(STATE, decision.newContext)
    ) {
      STATE.dailyContext.contexts.push({
        summary: decision.newContext,
        source: SOURCE,
        link: cleanLink,
        createdAt: new Date().toISOString(),
      });
    }
  }

  await saveState(STATE);
  return queuedCount > 0;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getPubDate(item) {
  return item?.pubDate ? new Date(item.pubDate).getTime() : 0;
}

function pruneCTSeen(STATE, retentionMs) {
  try {
    const now = Date.now();
    let pruned = 0;

    for (const [link, ts] of Object.entries(STATE.cricktracker?.seen || {})) {
      if (now - ts > retentionMs) {
        delete STATE.cricktracker.seen[link];
        pruned++;
      }
    }

    if (pruned > 0) {
      return true;
    }
  } catch (err) {
    console.warn("⚠️ CT seen prune failed:", err?.message || err);
  }
  return false;
}

function pruneDailyContext(STATE, retentionMs) {
  try {
    const ctx = STATE.dailyContext?.contexts;
    if (!Array.isArray(ctx) || ctx.length === 0) return false;

    const now = Date.now();
    const before = ctx.length;

    STATE.dailyContext.contexts = ctx.filter((c) => {
      const t = new Date(c.createdAt).getTime();
      return Number.isFinite(t) && now - t <= retentionMs;
    });

    if (before !== STATE.dailyContext.contexts.length) {
      return true;
    }
  } catch (err) {
    console.warn("⚠️ CT dailyContext prune failed:", err?.message || err);
  }
  return false;
}

function pruneUsedImages(STATE, retentionMs) {
  try {
    const now = Date.now();
    let pruned = 0;

    for (const [imgUrl, ts] of Object.entries(STATE.usedImages || {})) {
      if (now - ts > retentionMs) {
        delete STATE.usedImages[imgUrl];
        pruned++;
      }
    }

    if (pruned > 0) {
      return true;
    }
  } catch (err) {
    console.warn("⚠️ CT usedImages prune failed:", err?.message || err);
  }
  return false;
}

async function decideImageUsage({ imageUrl, usedImages }) {
  if (!imageUrl)
    return { useImage: false, reason: "🖼️ No imageUrl — text-only" };

  if (usedImages?.[imageUrl]) {
    return {
      useImage: false,
      reason: "🖼️ Image already used — forcing text-only",
    };
  }

  try {
    const localImagePath = await downloadImageToTemp(imageUrl);
    const ocrResult = await isRiskyTwitterImage(localImagePath);

    if (!ocrResult?.risky) return { useImage: true, reason: "" };

    return {
      useImage: false,
      reason: `⚠️ OCR flagged image as risky: ${ocrResult.reason || "unknown"}`,
    };
  } catch (err) {
    return {
      useImage: false,
      reason: `⚠️ OCR check failed, fallback to text-only: ${
        err?.message || err
      }`,
    };
  }
}

function contextExists(STATE, summary) {
  if (!STATE.dailyContext?.contexts?.length) return false;
  const norm = normalizeSummary(summary);
  return STATE.dailyContext.contexts.some(
    (c) => normalizeSummary(c.summary) === norm,
  );
}

function normalizeSummary(text = "") {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
