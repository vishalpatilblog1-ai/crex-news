// cricket-addictor/caNewsPollingLoop.js

import { judgeNewsContext } from "../indian-express/ai/judgeNewsContext.js";
import { tweetWithNativeImage } from "../twitter/tweetWithImage.js";
import { postTweet_ie_web } from "../twitter/twitter.js";
import { saveState } from "../utils/stateStoreCloud.js";
import { generateGPTCAtweet } from "./ai/generateGPTCAtweet.js";

import { generateGeminiCAtweet } from "./ai/generateGeminiCAtweet.js";
import { generateGeminiCAtweetSignal } from "./ai/generateGeminiCAtweetSignal.js";
import { isCAArticle, normalizeCALink } from "./caFilters.js";
import { isBlockedCAHeadline } from "./caHeadlineFilter.js";
import { fetchCARSS } from "./fetchCARss.js";
import { getCAImageUrl } from "./getCAImageUrl.js";
import { isRiskyTwitterImage } from "./ocr/detectTwitterReference.js";
import { downloadImageToTemp } from "./ocr/downloadImageToTemp.js";
import { parseCAArticle } from "./parseCAArticle.js";

export async function caNewsPollingLoop() {
  console.log("caNewsPollingLoop..");
  if (!global.STATE) return;

  const STATE = global.STATE;

  // ---- init state buckets ----
  STATE.ca ??= {};
  STATE.ca.seen ??= {};
  STATE.dailyContext ??= { contexts: [] };
  STATE.usedImages ??= {};

  // ---- config ----
  const MAX_AGE_MIN = 30;
  const CONSOLE_ONLY = process.env.CONSOLE_ONLY === "true";
  // const COVERED_RETENTION_HOURS = Number(
  //   process.env.COVERED_RETENTION_HOURS ?? 6
  // );
  const COVERED_RETENTION_HOURS = 1;
  const COVERED_RETENTION_HOURS_IMAGES = 4;
  const COVERED_RETENTION_MS = COVERED_RETENTION_HOURS * 60 * 60 * 1000;
  let stateDirty = false;
  stateDirty ||= pruneSeen(STATE, COVERED_RETENTION_MS);
  stateDirty ||= pruneDailyContext(STATE, COVERED_RETENTION_MS);
  stateDirty ||= pruneUsedImages(STATE, COVERED_RETENTION_HOURS_IMAGES);

  if (stateDirty) {
    // console.log("💾 Persisting pruned state to JSONBin");
    await saveState(STATE);
  }

  // ---- fetch rss ----
  const items = await fetchCARSS();
  // console.log("items", items);
  if (!Array.isArray(items) || items.length === 0) return;

  // ---- select candidate ----
  const sorted = items
    .filter(isCAArticle)
    .sort((a, b) => getPubDate(b) - getPubDate(a));

  let selected = null;
  // console.log("sorted::", sorted);

  for (const item of sorted) {
    const pubMs = getPubDate(item);
    if (!pubMs) continue;

    const ageMin = (Date.now() - pubMs) / 60000;
    if (ageMin > MAX_AGE_MIN) continue;

    const cleanLink = normalizeCALink(item.link);
    if (!cleanLink) continue;

    if (STATE.ca.seen[cleanLink]) continue;

    //temproray commented

    // if (isBlockedCAHeadline(item.title)) {
    //   STATE.ca.seen[cleanLink] = Date.now();
    //   console.log("⛔ skipped utility headline (blocked):", item.title);
    //   continue;
    // }

    const isUtilityHeadline = isBlockedCAHeadline(item.title);
    // console.log("isUtilityHeadline");
    selected = {
      item,
      mode: isUtilityHeadline ? "SIGNAL" : "ANALYSIS",
    };
    // selected = item;
    break;
  }

  if (!selected) return;

  // const cleanLink = normalizeCALink(selected.link);
  // const parsed = parseCAArticle(selected);
  const { item, mode } = selected;
  const cleanLink = normalizeCALink(item.link);
  // console.log("item::", item);
  const parsed = parseCAArticle(item);
  if (!parsed?.body || parsed.body.length < 80) return;

  // temporary commented

  let decision = null;
  try {
    decision = await judgeNewsContext({
      articleText: `${parsed.headline}\n${parsed.body}`,
      existingContexts:
        STATE.dailyContext?.contexts?.map((c) => c.summary) || [],
    });

    if (decision?.isAlreadyCovered && decision?.confidence >= 0.8) {
      console.log("🔴🔴 News neglected by CA because already covered 🔴🔴");

      if (
        typeof decision.matchedIndex === "number" &&
        STATE.dailyContext?.contexts?.[decision.matchedIndex]
      ) {
        console.log(
          "🧠 Matched dailyContext object:",
          STATE.dailyContext.contexts[decision.matchedIndex]
        );
      } else {
        console.log("⚠️ matchedIndex missing/out-of-bounds:", decision);
      }
      STATE.ca.seen[cleanLink] = Date.now();
      await saveState(STATE);
      return;
    }
  } catch (err) {
    console.warn("⚠️ judgeNewsContext failed:", err?.message || err);
  }

  // let tweetText = "";
  // let tweetGeminiText = "";
  // let tweetGPTText = "";
  // try {
  //   tweetGeminiText = await generateGeminiCAtweet(
  //     `${parsed.headline}\n${parsed.body}`
  //   );
  //   tweetGPTText = await generateGPTCAtweet(
  //     `${parsed.headline}\n${parsed.body}`
  //   );
  // } catch (err) {
  //   console.warn("⚠️ generateGeminiCAtweet failed:", err?.message || err);
  // }
  let tweetGeminiText = null;
  let tweetGPTText = null;

  try {
    tweetGeminiText = await generateGeminiCAtweet(
      `${parsed.headline}\n${parsed.body}`
    );
  } catch (err) {
    console.warn("⚠️ Gemini failed, falling back to GPT:", err?.message || err);
  }

  if (!tweetGeminiText) {
    try {
      tweetGPTText = await generateGPTCAtweet(
        `${parsed.headline}\n${parsed.body}`
      );
    } catch (err) {
      console.error("❌ GPT also failed:", err?.message || err);
    }
  }

  const tweetText = tweetGeminiText || tweetGPTText;

  if (!tweetText) {
    console.warn("⚠️ No tweet generated by either model");
    return;
  }

  if (!tweetText || tweetText.length < 30) {
    console.log("⚠️ Tweet text too short, skipping");
    STATE.ca.seen[cleanLink] = Date.now();
    await saveState(STATE);
    return;
  }

  const imageUrl = getCAImageUrl(item);

  console.log("\n");
  console.log("CA tweetGeminiText::", tweetGeminiText);
  console.log("CA tweetGPTText::", tweetGPTText);
  console.log("CA imageUrl::", imageUrl);
  console.log("CA link::", item.link);

  if (!CONSOLE_ONLY) {
    const { useImage, reason } = await decideImageUsage({
      imageUrl,
      usedImages: STATE.usedImages,
    });

    if (!useImage) {
      if (reason) console.log(reason);

      if (isBlockedCAHeadline(item.title)) {
        console.log("⛔ Duplicate image + utility headline — skipping");
        STATE.ca.seen[cleanLink] = Date.now();
        await saveState(STATE);
        return;
      }

      console.log("eligible for only text");
      await postTweet_ie_web({ text: tweetText });
    } else {
      console.log("eligible for text with image");
      await tweetWithNativeImage({ text: tweetText, imageUrl });
      STATE.usedImages[imageUrl] = Date.now();
    }
  } else {
    console.log("🧪 CONSOLE_ONLY=true — not posting to X");
  }

  if (decision?.newContext) {
    if (!contextExists(STATE, decision.newContext)) {
      STATE.dailyContext.contexts.push({
        summary: decision.newContext,
        source: "CA",
        link: cleanLink,
        createdAt: new Date().toISOString(),
      });
    } else {
      console.log("🧠 Duplicate dailyContext skipped");
    }
  }

  // ---- final persist ----
  STATE.ca.seen[cleanLink] = Date.now();
  await saveState(STATE);
}

function getPubDate(item) {
  return item?.pubDate ? new Date(item.pubDate).getTime() : 0;
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
