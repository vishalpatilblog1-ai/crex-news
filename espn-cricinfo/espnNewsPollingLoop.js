// espn/espnNewsPollingLoop.js

import { fetchESPNRss } from "./fetchESPNRss.js";
import { isESPNArticle, normalizeESPNLink } from "./espnFilters.js";
import { parseESPNArticle } from "./parseESPNArticle.js";

import { generateGPTTweet } from "../ai/generate-gpt-tweet.js";
import {
  classifyArticle,
  generateClaudeTweetWithType,
  SIGNIFICANCE_EXEMPT_TYPES,
} from "../ai/generateClaudeTweet.js";

import { judgeNewsContext } from "../indian-express/ai/judgeNewsContext.js";
import { isBlockedCAHeadline } from "../cricket-addictor/caHeadlineFilter.js";
import { isRiskyTwitterImage } from "../cricket-addictor/ocr/detectTwitterReference.js";
import { downloadImageToTemp } from "../cricket-addictor/ocr/downloadImageToTemp.js";

import { applySourceSignature, enqueueTweet } from "../twitter/tweetQueue.js";
import { saveState } from "../utils/stateStoreCloud.js";

const MAX_AGE_MIN = 45;
const RETENTION_MS = 6 * 60 * 60 * 1000;
const MAX_PER_POLL = 5;

export async function espnNewsPollingLoop() {
  // console.log("espnNewsPollingLoop started ...");
  if (!global.STATE) return false;

  const STATE = global.STATE;

  STATE.espn ??= {};
  STATE.espn.seen ??= {};
  STATE.dailyContext ??= { contexts: [] };
  STATE.usedImages ??= {};

  const today = new Date().toISOString().slice(0, 10);
  if (!STATE.dailyContext.date || STATE.dailyContext.date !== today) {
    STATE.dailyContext = { date: today, contexts: [] };
  }

  // ── Prune state ────────────────────────────────────
  let stateDirty = false;
  stateDirty ||= pruneESPNSeen(STATE, RETENTION_MS);
  stateDirty ||= pruneDailyContext(STATE, RETENTION_MS);
  stateDirty ||= pruneUsedImages(STATE, RETENTION_MS);

  if (stateDirty) {
    // console.log("💾 Persisting pruned ESPN state");
    await saveState(STATE);
  }

  // ── Fetch RSS ──────────────────────────────────────
  let originalItems;
  try {
    originalItems = await fetchESPNRss();
  } catch (err) {
    console.warn("⚠️ ESPN RSS fetch failed:", err?.message || err);
    return false;
  }

  if (!Array.isArray(originalItems) || originalItems.length === 0) return false;

  const items = originalItems.slice(0, 10).filter(isESPNArticle);

  // ── Collect ALL unseen, non-aged-out candidates ─────
  const candidates = [];
  for (const item of items) {
    const ageMin = (Date.now() - item.pubDate) / 60000;
    if (ageMin > MAX_AGE_MIN) continue;

    const cleanUrl = normalizeESPNLink(item.link);
    if (!cleanUrl) continue;
    if (STATE.espn.seen[cleanUrl]) continue;

    if (isBlockedCAHeadline(item.title)) {
      STATE.espn.seen[cleanUrl] = Date.now();
      continue;
    }

    candidates.push({ item, cleanUrl });
  }

  // console.log(
  //   `📰 ESPN list: ${items.length} articles, ${candidates.length} unseen candidates`,
  // );

  if (candidates.length === 0) {
    await saveState(STATE);
    return false;
  }

  let queuedCount = 0;

  for (const { item, cleanUrl } of candidates) {
    if (queuedCount >= MAX_PER_POLL) {
      console.log(
        `⏸️ ESPN hit MAX_PER_POLL (${MAX_PER_POLL}) — remaining stay unseen for next poll`,
      );
      break;
    }

    // ── Parse ──────────────────────────────────────
    const parsed = await parseESPNArticle({
      storyId: item.canonicalId,
      title: item.title,
    });

    if (!parsed?.body || parsed.body.length < 80) {
      STATE.espn.seen[cleanUrl] = Date.now();
      continue;
    }

    const selected = { ...parsed, link: item.link, pubDate: item.pubDate };
    const fullText = `${selected.headline}\n${selected.body}`;

    // ── Step 1: Classify ───────────────────────────
    let articleType = "general_news";
    try {
      articleType = await classifyArticle(fullText);
      console.log("🏷️ Article classified as:", articleType);
    } catch (err) {
      console.warn("⚠️ classify failed:", err?.message);
    }

    // ── Step 2: Dedup + significance ────────────────
    let decision = null;
    try {
      decision = await judgeNewsContext({
        articleText: selected.body,
        existingContexts: STATE.dailyContext.contexts.map((c) => c.summary),
      });

      if (decision?.isAlreadyCovered && decision?.confidence >= 0.8) {
        console.log("🔁 ESPN duplicate context — skipping:", selected.headline);
        STATE.espn.seen[cleanUrl] = Date.now();
        continue;
      }

      const isExempt = SIGNIFICANCE_EXEMPT_TYPES.has(articleType);
      const score = decision?.significanceScore ?? 10;

      if (!isExempt && score < 7) {
        console.log(
          `⬇️ ESPN low significance (${score}/10) — skipping: ${selected.headline}`,
        );
        STATE.espn.seen[cleanUrl] = Date.now();
        continue;
      }

      if (isExempt) {
        console.log(`🌟 ESPN exempt type (${articleType})`);
      } else {
        console.log(`✅ ESPN significance: ${score}/10`);
      }
    } catch (err) {
      console.warn("⚠️ ESPN context judge failed:", err?.message);
    }

    // ── Step 3: Image risk-check + dedup ────────────
    const imageUrl = selected.imageUrl || null;
    const { useImage } = await decideImageUsage({
      imageUrl,
      usedImages: STATE.usedImages,
    });

    // ── Step 4: Tweet generation ────────────────────
    let tweetText = null;
    try {
      const result = await generateClaudeTweetWithType(
        fullText,
        articleType,
        "ESPN",
      );
      tweetText = result?.tweetText;
    } catch (err) {
      console.warn("⚠️ Claude failed:", err?.message || err);
    }

    if (!tweetText || tweetText.trim().length < 30) {
      try {
        tweetText = await generateGPTTweet(fullText);
      } catch (err) {
        console.warn("⚠️ GPT fallback failed:", err?.message || err);
      }
    }

    if (!tweetText || tweetText.length < 30) {
      console.log("❌ ESPN AI failed — skipping:", selected.headline);
      STATE.espn.seen[cleanUrl] = Date.now();
      continue;
    }

    tweetText = applySourceSignature(tweetText, "ESPN");

    // console.log("tweetText>>>", tweetText);

    // ── Enqueue ──────────────────────────────────────
    enqueueTweet({
      id: `ESPN:${cleanUrl}`,
      source: "ESPN",
      text: tweetText,
      // imageUrl: useImage ? imageUrl : null,
      imageUrl: null,
      seenKey: cleanUrl,
    });

    console.log("📥 Queued ESPN article:", selected.headline);

    if (useImage && imageUrl) {
      STATE.usedImages[imageUrl] = Date.now();
    }

    STATE.espn.seen[cleanUrl] = Date.now();
    queuedCount++;

    if (decision?.newContext && !contextExists(STATE, decision.newContext)) {
      STATE.dailyContext.contexts.push({
        summary: decision.newContext,
        source: "ESPN",
        link: cleanUrl,
        createdAt: new Date().toISOString(),
      });
    }
  }

  await saveState(STATE);
  return queuedCount > 0;
}

// ── Helpers ──────────────────────────────────────────

function pruneESPNSeen(STATE, retentionMs) {
  try {
    const now = Date.now();
    let pruned = 0;
    for (const [link, ts] of Object.entries(STATE.espn?.seen || {})) {
      if (now - ts > retentionMs) {
        delete STATE.espn.seen[link];
        pruned++;
      }
    }
    if (pruned > 0) {
      // console.log(`🧹 Pruned ${pruned} old ESPN seen entries`);
      return true;
    }
  } catch (err) {
    console.warn("⚠️ ESPN seen prune failed:", err?.message || err);
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
      // console.log(
      //   `🧹 Pruned ${before - STATE.dailyContext.contexts.length} old dailyContext entries`,
      // );
      return true;
    }
  } catch (err) {
    console.warn("⚠️ ESPN dailyContext prune failed:", err?.message || err);
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
      // console.log(`🧹 Pruned ${pruned} old usedImages entries`);
      return true;
    }
  } catch (err) {
    console.warn("⚠️ ESPN usedImages prune failed:", err?.message || err);
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
      reason: `⚠️ OCR check failed, fallback to text-only: ${err?.message || err}`,
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
