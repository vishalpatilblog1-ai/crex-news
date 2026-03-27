// cricket-addictor/caNewsPollingLoop.js

import { generateGPTTweet } from "../ai/generate-gpt-tweet.js";
import {
  classifyArticle,
  generateClaudeTweet,
  SIGNIFICANCE_EXEMPT_TYPES,
} from "../ai/generateClaudeTweet.js";
import { generateCardImage } from "../canvas/imageRenderer.js";
import { judgeNewsContext } from "../indian-express/ai/judgeNewsContext.js";
import { applySourceSignature, enqueueTweet } from "../twitter/tweetQueue.js";
import { CREX_BASE_IMAGE_TEMPLATE } from "../utils/config.js";
import { saveState } from "../utils/stateStoreCloud.js";

import { isCAArticle, normalizeCALink } from "./caFilters.js";
import { isBlockedCAHeadline } from "./caHeadlineFilter.js";
import { fetchCARSS } from "./fetchCARss.js";
import { isRiskyTwitterImage } from "./ocr/detectTwitterReference.js";
import { downloadImageToTemp } from "./ocr/downloadImageToTemp.js";
import { parseCAArticleRss } from "./parseCAArticleRss.js";

const MAX_AGE_MIN = 60;
const CONSOLE_ONLY = process.env.CONSOLE_ONLY === "true";
const RETENTION_MS = 6 * 60 * 60 * 1000;

export async function caNewsPollingLoop() {
  console.log("caNewsPollingLoop..");
  if (!global.STATE) return false;

  const STATE = global.STATE;

  STATE.ca ??= {};
  STATE.ca.seen ??= {};
  STATE.dailyContext ??= { contexts: [] };
  STATE.usedImages ??= {};

  // ── Prune state ───────────────────────────────────────────────────────────
  let stateDirty = false;
  stateDirty ||= pruneSeen(STATE, RETENTION_MS);
  stateDirty ||= pruneDailyContext(STATE, RETENTION_MS);
  stateDirty ||= pruneUsedImages(STATE, RETENTION_MS);

  if (stateDirty) await saveState(STATE, "prune cleanup");

  // ── Fetch RSS ─────────────────────────────────────────────────────────────
  let items;
  try {
    items = await fetchCARSS();
  } catch (err) {
    console.warn("❌ CA RSS fetch failed:", err?.message || err);
    throw err;
  }

  if (!Array.isArray(items) || items.length === 0) return false;

  // const sorted = [...items].filter(isCAArticle);
  const sorted = [...items]
    .filter(isCAArticle)
    .sort((a, b) => getPubDate(b) - getPubDate(a));

  let selected = null;

  for (const item of sorted) {
    const pubMs = getPubDate(item);

    if (pubMs) {
      const ageMin = (Date.now() - pubMs) / 60000;
      if (ageMin > MAX_AGE_MIN) continue;
    }

    const cleanLink = normalizeCALink(item.link);
    if (!cleanLink) continue;

    if (STATE.ca.seen[cleanLink]) continue;

    if (isBlockedCAHeadline(item.headline)) {
      STATE.ca.seen[cleanLink] = Date.now();
      continue;
    }

    selected = item;
    break;
  }

  if (!selected) return false;

  const cleanLink = normalizeCALink(selected.link);

  try {
    const parsed = parseCAArticleRss(selected);

    if (!parsed?.headline || !parsed?.body || parsed.body.length < 80) {
      STATE.ca.seen[cleanLink] = Date.now();
      await saveState(STATE, "invalid article structure");
      return false;
    }

    const fullText = `${parsed.headline}\n${parsed.body}`;

    // ── Step 1: Classify article type first ──────────────────────────────────
    let articleType = "player_form";
    try {
      articleType = await classifyArticle(fullText);
      // console.log(`🏷️ Classified as: ${articleType}`);
    } catch (err) {
      console.warn("⚠️ classifyArticle failed, using default:", err?.message);
    }

    // ── Step 2: Deduplication + significance gate ─────────────────────────────
    let decision = null;
    try {
      decision = await judgeNewsContext({
        articleText: fullText,
        existingContexts:
          STATE.dailyContext?.contexts?.map((c) => c.summary) || [],
      });

      if (decision?.isAlreadyCovered && decision?.confidence >= 0.8) {
        console.log("🔴 CA skipped — already covered context");
        STATE.ca.seen[cleanLink] = Date.now();
        await saveState(STATE, "duplicate context skipped");
        return false;
      }

      const isExempt = SIGNIFICANCE_EXEMPT_TYPES.has(articleType);
      const score = decision?.significanceScore ?? 10;

      if (!isExempt && score < 7) {
        console.log(
          `⬇️ Low significance (${score}/10) — skipping: ${parsed.headline}`
        );
        STATE.ca.seen[cleanLink] = Date.now();
        await saveState(STATE);
        return true;
      }

      if (isExempt) {
        console.log(
          `🌟 Exempt type (${articleType}) — bypassing significance gate (score: ${score}/10)`
        );
      } else {
        console.log(`✅ Significance: ${score}/10 — proceeding`);
      }
    } catch (err) {
      console.warn("⚠️ judgeNewsContext failed:", err?.message || err);
    }

    // ── Step 3: Tweet generation ──────────────────────────────────────────────
    let tweetText = null;
    let generatedPath = null;

    try {
      const { tweetText: claudeTweet, card } = await generateClaudeTweet(
        fullText
      );
      tweetText = claudeTweet;

      if (card) {
        try {
          generatedPath = await generateCardImage(
            CREX_BASE_IMAGE_TEMPLATE,
            card
          );

          console.log("generatedPath:::", generatedPath);
        } catch (err) {
          console.error("❌ Image generation failed:", err);
        }
      } else {
        console.log("📝 Text-only tweet (no card)");
      }

      console.log("Prompt generated by Claude ....");
    } catch (err) {
      console.warn("⚠️ Claude failed:", err?.message || err);
    }

    if (!tweetText || tweetText.trim().length < 30) {
      try {
        tweetText = await generateGPTTweet(fullText);
        console.log("Prompt generated by GPT ....");
      } catch (err) {
        console.warn("⚠️ GPT failed:", err?.message || err);
      }
    }

    if (!tweetText || tweetText.length < 30) {
      STATE.ca.seen[cleanLink] = Date.now();
      await saveState(STATE, "tweet generation failed or too short");
      return false;
    }

    // ── Image check ───────────────────────────────────────────────────────────
    const imageUrl = parsed.imageUrl || null;
    const { useImage } = await decideImageUsage({
      imageUrl,
      usedImages: STATE.usedImages,
    });

    console.log("imageUrl::", imageUrl);

    tweetText = applySourceSignature(tweetText, "CA");

    const tweetId = `CA:${cleanLink}`;

    enqueueTweet({
      id: tweetId,
      source: "CA",
      text: tweetText,
      imageUrl: generatedPath || null,
      // imageUrl: useImage ? imageUrl : null,
      seenKey: cleanLink,
    });

    console.log(`📥 Queued CA tweet: ${parsed.headline}`);

    STATE.ca.seen[cleanLink] = Date.now();

    if (useImage && imageUrl) {
      STATE.usedImages[imageUrl] = Date.now();
    }

    if (decision?.newContext && !contextExists(STATE, decision.newContext)) {
      STATE.dailyContext.contexts.push({
        summary: decision.newContext,
        source: "CA",
        link: cleanLink,
        createdAt: new Date().toISOString(),
      });
    }

    await saveState(STATE);
    console.log(`✅ CA published: ${parsed.headline}`);
    return true;
  } catch (err) {
    console.warn("⚠️ CA processing failed:", err?.message || err);
    return false;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getPubDate(item) {
  const d = item?.pubDate || item?.publishedAt;
  return d ? new Date(d).getTime() : 0;
}

function pruneSeen(STATE, retentionMs) {
  try {
    const now = Date.now();
    let pruned = 0;

    for (const [link, ts] of Object.entries(STATE.ca?.seen || {})) {
      if (now - ts > retentionMs) {
        delete STATE.ca.seen[link];
        pruned++;
      }
    }

    if (pruned > 0) {
      console.log(`🧹 Pruned ${pruned} old CA seen entries`);
      return true;
    }
  } catch (err) {
    console.warn("⚠️ CA seen prune failed:", err?.message || err);
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

    const after = STATE.dailyContext.contexts.length;

    if (before !== after) {
      console.log(`🧹 Pruned ${before - after} old dailyContext entries`);
      return true;
    }
  } catch (err) {
    console.warn("⚠️ dailyContext prune failed:", err?.message || err);
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
      console.log(`🧹 Pruned ${pruned} old usedImages entries`);
      return true;
    }
  } catch (err) {
    console.warn("⚠️ usedImages prune failed:", err?.message || err);
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
    (c) => normalizeSummary(c.summary) === norm
  );
}

function normalizeSummary(text = "") {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
