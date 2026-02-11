// sportskeeda/sportskeedaNewsPollingLoop.js

import { fetchSportskeedaRss } from "./fetchSportskeedaRss.js";
import { isSportskeedaArticle } from "./isSportskeedaArticle.js";
import { normalizeSportskeedaLink } from "./normalizeSportskeedaLink.js";
import { parseSportskeedaArticle } from "./parseSportskeedaArticle.js";

import { generateGeminiTweet } from "../ai/generate-gemini-tweet.js";
import { generateGPTTweet } from "../ai/generate-gpt-tweet.js";
import { judgeNewsContext } from "../indian-express/ai/judgeNewsContext.js";

import { applySourceSignature, enqueueTweet } from "../twitter/tweetQueue.js";
import { saveState } from "../utils/stateStoreCloud.js";

import { isBlockedCAHeadline } from "../cricket-addictor/caHeadlineFilter.js";
import { isRiskyTwitterImage } from "../cricket-addictor/ocr/detectTwitterReference.js";
import { downloadImageToTemp } from "../cricket-addictor/ocr/downloadImageToTemp.js";

export async function sportskeedaNewsPollingLoop() {
  console.log("🟢 sportskeedaNewsPollingLoop started");

  console.log("---------------------- 1 ---------------------- ");

  if (!global.STATE) return false;
  const STATE = global.STATE;

  /* ---------------- init state ---------------- */
  STATE.sportskeeda ??= {};
  STATE.sportskeeda.seen ??= {};
  STATE.dailyContext ??= { contexts: [] };
  STATE.usedImages ??= {};

  /* ---------------- config ---------------- */
  const MAX_AGE_MIN = 120; // 3 hours
  const RETENTION_MS = 6 * 60 * 60 * 1000; // 6 hours

  /* ---------------- prune state ---------------- */
  let stateDirty = false;
  stateDirty ||= pruneSeen(STATE, RETENTION_MS);
  stateDirty ||= pruneDailyContext(STATE, RETENTION_MS);
  stateDirty ||= pruneUsedImages(STATE, RETENTION_MS);

  if (stateDirty) await saveState(STATE);

  /* ---------------- fetch RSS ---------------- */
  const items = await fetchSportskeedaRss();
  if (!Array.isArray(items) || items.length === 0) return false;

  /* ---------------- select ONE eligible article ---------------- */
  let selected = null;

  // console.log("items::", items);

  for (const item of items) {
    console.log("-------------- A --------------");
    if (!isSportskeedaArticle(item)) continue;

    console.log("-------------- B --------------");
    const pubMs = item.pubDate ? new Date(item.pubDate).getTime() : 0;
    if (!pubMs) continue;
    console.log("-------------- C --------------");
    const ageMin = (Date.now() - pubMs) / 60000;
    if (ageMin > MAX_AGE_MIN) continue;

    console.log("-------------- D --------------");
    const cleanUrl = normalizeSportskeedaLink(item.link);
    if (!cleanUrl) continue;

    console.log("-------------- E --------------");
    const seenKey = `${cleanUrl}:${item.pubDate}`;
    if (STATE.sportskeeda.seen[seenKey]) continue;

    console.log("-------------- F --------------");
    console.log("item.title::", item.title);
    if (isBlockedCAHeadline(item.title)) {
      STATE.sportskeeda.seen[seenKey] = Date.now();
      continue;
    }

    console.log("-------------- G --------------");
    selected = item;
    break;
  }

  if (!selected) return false;

  console.log("📰 Selected Sportskeeda item:", selected);

  const cleanUrl = normalizeSportskeedaLink(selected.link);
  const finalSeenKey = cleanUrl + ":" + selected.pubDate;

  let parsed = null;
  let articleText = null;

  try {
    parsed = await parseSportskeedaArticle({ link: selected.link });
  } catch (err) {
    console.warn("❌ Sportskeeda parse failed:", err?.message || err);
  }
  console.log("Parsed length:", parsed?.body?.length);
  if (parsed?.headline && parsed?.body && parsed.body.length > 120) {
    articleText = `${parsed.headline}\n${parsed.body}`;
    console.log("🟢 Using FULL parsed article");
  } else {
    const headline = selected.title?.trim();
    const description = selected.description?.trim();

    if (!headline || !description || description.length < 40) {
      // STATE.sportskeeda.seen[cleanUrl] = Date.now();
      STATE.sportskeeda.seen[finalSeenKey] = Date.now();
      await saveState(STATE);
      return false;
    }

    articleText = `${headline}\n${description}`;
    console.log("🟡 Using RSS fallback");
  }

  let decision = null;
  try {
    decision = await judgeNewsContext({
      articleText,
      existingContexts:
        STATE.dailyContext?.contexts?.map((c) => c.summary) || [],
    });

    if (decision?.isAlreadyCovered && decision?.confidence >= 0.8) {
      // STATE.sportskeeda.seen[cleanUrl] = Date.now();
      STATE.sportskeeda.seen[finalSeenKey] = Date.now();
      await saveState(STATE);
      return false;
    }
  } catch (err) {
    console.warn("⚠️ judgeNewsContext failed:", err?.message || err);
  }
  console.log("---------------------- 3 ---------------------- ");

  let tweetText = null;

  try {
    tweetText = await generateGeminiTweet(articleText);
  } catch (err) {
    console.warn("⚠️ Gemini failed:", err?.message || err);
  }
  console.log("---------------------- 5 ---------------------- ");

  if (!tweetText) {
    try {
      tweetText = await generateGPTTweet(articleText);
    } catch (err) {
      console.warn("❌ GPT failed:", err?.message || err);
    }
  }

  if (!tweetText || tweetText.length < 30) {
    // STATE.sportskeeda.seen[cleanUrl] = Date.now();
    STATE.sportskeeda.seen[finalSeenKey] = Date.now();
    await saveState(STATE);
    return false;
  }

  console.log("---------------------- 6 ---------------------- ");
  // const imageUrl = selected["media:thumbnail"]?.url || parsed.imageUrl || null;
  const imageUrl = selected["media:thumbnail"]?.url || null;

  const { useImage } = await decideImageUsage({
    imageUrl,
    usedImages: STATE.usedImages,
  });

  tweetText = applySourceSignature(tweetText, "SK");
  console.log("---------------------- 7 ---------------------- ");

  console.log("tweetText:::", tweetText);
  console.log("imageUrl:::", imageUrl);

  enqueueTweet({
    id: `SPORTSKEEDA:${cleanUrl}`,
    source: "SPORTSKEEDA",
    text: tweetText,
    imageUrl: useImage ? imageUrl : null,
    seenKey: finalSeenKey,
  });

  STATE.sportskeeda.seen[finalSeenKey] = Date.now();

  if (decision?.newContext && !contextExists(STATE, decision.newContext)) {
    STATE.dailyContext.contexts.push({
      summary: decision.newContext,
      source: "SPORTSKEEDA",
      link: cleanUrl,
      createdAt: new Date().toISOString(),
    });
  }

  await saveState(STATE);
  // console.log("✅ Sportskeeda published:", parsed.headline);
  return true;
}

function pruneSeen(STATE, retentionMs) {
  try {
    const now = Date.now();
    let pruned = 0;
    for (const [link, ts] of Object.entries(STATE.sportskeeda?.seen || {})) {
      if (now - ts > retentionMs) {
        delete STATE.sportskeeda.seen[link];
        pruned++;
      }
    }

    if (pruned > 0) {
      console.log(`🧹 Pruned ${pruned} old SK seen entries`);
      return true;
    }
  } catch (err) {
    console.warn("⚠️ SK seen prune failed:", err?.message || err);
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
