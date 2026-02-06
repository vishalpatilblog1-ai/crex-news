// cricket-addictor/caNewsPollingLoop.js

import { generateGeminiTweet } from "../ai/generate-gemini-tweet.js";
import { generateGPTTweet } from "../ai/generate-gpt-tweet.js";
import { judgeNewsContext } from "../indian-express/ai/judgeNewsContext.js";
import { tweetWithNativeImage } from "../twitter/tweetWithImage.js";
import { postTweet_ie_web } from "../twitter/twitter.js";
import { saveState } from "../utils/stateStoreCloud.js";

import { isCAArticle, normalizeCALink } from "./caFilters.js";
import { isBlockedCAHeadline } from "./caHeadlineFilter.js";
import { fetchCAHomeHtml } from "./fetchCAHtml.js";
import { isRiskyTwitterImage } from "./ocr/detectTwitterReference.js";
import { downloadImageToTemp } from "./ocr/downloadImageToTemp.js";
import { parseCAArticle } from "./parseCAArticle.js";

/**
 * CA polling loop (HTML discovery mode)
 * - No enqueue queue: publishes inline for deterministic behavior on Railway/AWS.
 * - Uses STATE.ca.queued as an in-flight guard only.
 */
export async function caNewsPollingLoop() {
  console.log("caNewsPollingLoop..");
  if (!global.STATE) return false;

  const STATE = global.STATE;

  /* ---------------- init state ---------------- */
  STATE.ca ??= {};
  STATE.ca.seen ??= {};
  // STATE.ca.queued ??= {};
  STATE.dailyContext ??= { contexts: [] };
  STATE.usedImages ??= {};

  /* ---------------- config ---------------- */
  const MAX_AGE_MIN = 180; // 3 hours
  // const MAX_BATCH = 10;
  const CONSOLE_ONLY = process.env.CONSOLE_ONLY === "true";
  const RETENTION_MS = 4 * 60 * 60 * 1000; // 4 hours

  /* ---------------- prune state ---------------- */
  let stateDirty = false;
  stateDirty ||= pruneSeen(STATE, RETENTION_MS);
  stateDirty ||= pruneDailyContext(STATE, RETENTION_MS);
  stateDirty ||= pruneUsedImages(STATE, RETENTION_MS);

  if (stateDirty) await saveState(STATE);

  /* ---------------- fetch CA homepage items ---------------- */
  let items;
  try {
    items = await fetchCAHomeHtml({ limit: 15 });
    // console.log("items>>>::", items);
  } catch (err) {
    console.warn("❌ CA HTML fetch failed:", err?.message || err);
    throw err;
  }

  if (!Array.isArray(items) || items.length === 0) return false;

  /* ---------------- collect eligible articles ---------------- */
  const sorted = [...items].filter(isCAArticle);

  const eligible = [];

  for (const item of sorted) {
    // if (eligible.length >= MAX_BATCH) break;

    const pubMs = getPubDate(item);

    // If pubDate exists, enforce freshness window
    if (pubMs) {
      const ageMin = (Date.now() - pubMs) / 60000;
      if (ageMin > MAX_AGE_MIN) continue;
    }
    // If pubDate missing, allow (HTML discovery mode)

    const cleanLink = normalizeCALink(item.link);
    if (!cleanLink) continue;

    if (STATE.ca.seen[cleanLink]) continue;
    // if (STATE.ca.queued[cleanLink]) continue;

    if (isBlockedCAHeadline(item.headline)) {
      STATE.ca.seen[cleanLink] = Date.now();
      continue;
    }

    eligible.push(item);
    // STATE.ca.queued[cleanLink] = Date.now();
  }

  // console.log("eligible::", eligible);
  if (eligible.length === 0) return false;

  /* ---------------- process eligible articles sequentially ---------------- */

  for (const item of eligible) {
    const cleanLink = normalizeCALink(item.link);

    try {
      const parsed = await parseCAArticle(item);

      if (!parsed?.headline || !parsed?.body || parsed.body.length < 80) {
        STATE.ca.seen[cleanLink] = Date.now();
        continue;
      }

      /* -------- context check -------- */
      let decision = null;
      try {
        decision = await judgeNewsContext({
          articleText: `${parsed.headline}\n${parsed.body}`,
          existingContexts:
            STATE.dailyContext?.contexts?.map((c) => c.summary) || [],
        });

        if (decision?.isAlreadyCovered && decision?.confidence >= 0.8) {
          STATE.ca.seen[cleanLink] = Date.now();
          continue;
        }
      } catch (err) {
        console.warn("⚠️ judgeNewsContext failed:", err?.message || err);
      }

      /* -------- generate tweet -------- */
      let tweetText = null;

      try {
        tweetText = await generateGeminiTweet(
          `${parsed.headline}\n${parsed.body}`
        );
      } catch (err) {
        console.warn("⚠️ Gemini failed:", err?.message || err);
      }

      if (!tweetText) {
        try {
          tweetText = await generateGPTTweet(
            `${parsed.headline}\n${parsed.body}`
          );
        } catch (err) {
          console.warn("❌ GPT failed:", err?.message || err);
        }
      }

      if (!tweetText || tweetText.length < 30) {
        STATE.ca.seen[cleanLink] = Date.now();
        continue;
      }

      /* -------- decide image usage + publish inline -------- */
      const imageUrl = parsed.imageUrl || null;

      const { useImage, reason } = await decideImageUsage({
        imageUrl,
        usedImages: STATE.usedImages,
      });

      console.log("tweetText:", tweetText);
      console.log("imageUrl:", imageUrl);
      console.log("useImage:", useImage);

      if (CONSOLE_ONLY) {
        console.log("🧪 CONSOLE_ONLY would publish:", {
          headline: parsed.headline,
          link: cleanLink,
          tweetText,
          imageUrl,
          useImage,
          reason,
        });

        // In console-only mode, do NOT mark as seen (keeps prod behaviour separate)
        continue;
      }

      if (useImage) {
        await tweetWithNativeImage({ text: tweetText, imageUrl });
        if (imageUrl) STATE.usedImages[imageUrl] = Date.now();
      } else {
        await postTweet_ie_web({ text: tweetText });
      }

      // ✅ mark seen ONLY after successful publish
      STATE.ca.seen[cleanLink] = Date.now();

      // store new context if any
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
    } catch (err) {
      // if publish fails, we do NOT mark as seen, so it can retry next cycle
      console.warn("⚠️ CA item processing failed:", err?.message || err);
    } finally {
      // always release in-flight guard
      // delete STATE.ca.queued[cleanLink];
    }
  }

  return true;
}

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
