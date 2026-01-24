// cricket-addictor/ctNewsPollingLoop.js

import { judgeNewsContext } from "../indian-express/ai/judgeNewsContext.js";
import { tweetWithNativeImage } from "../twitter/tweetWithImage.js";
import { postTweet_ie_web } from "../twitter/twitter.js";
import { saveState } from "../utils/stateStoreCloud.js";

import { fetchCTRSS } from "./fetchCTRSS.js";
import { parseCTArticle } from "./parseCTArticle.js";
import { getCTImageUrl } from "./getCTImageUrl.js";
import { isCTArticle, normalizeCTLink } from "./ctFilters.js";
import { isBlockedCAHeadline } from "../cricket-addictor/caHeadlineFilter.js";

import { downloadImageToTemp } from "../cricket-addictor/ocr/downloadImageToTemp.js";
import { isRiskyTwitterImage } from "../cricket-addictor/ocr/detectTwitterReference.js";
import { generateGeminiCAtweet } from "../cricket-addictor/ai/generateGeminiCAtweet.js";

export async function ctNewsPollingLoop() {
  console.log("ctNewsPollingLoop..");
  if (!global.STATE) return;

  const STATE = global.STATE;
  STATE.cricktracker ??= {};
  STATE.cricktracker.seen ??= {};

  const MAX_AGE_MIN = 60;
  const CONSOLE_ONLY = process.env.CONSOLE_ONLY === "true";

  const RETENTION_HOURS = 24;
  const RETENTION_MS = RETENTION_HOURS * 60 * 60 * 1000;

  /* -------------------- PRUNE SEEN -------------------- */
  console.log("ctNewsPollingLoop..1");
  try {
    const now = Date.now();
    let pruned = 0;

    for (const [link, ts] of Object.entries(STATE.cricktracker.seen)) {
      if (now - ts > RETENTION_MS) {
        delete STATE.cricktracker.seen[link];
        pruned++;
      }
    }

    if (pruned) {
      console.log(`🧹 Pruned ${pruned} old CT seen entries`);
    }
  } catch (err) {
    console.warn("⚠️ CT seen prune failed:", err.message);
  }

  console.log("ctNewsPollingLoop..2");
  /* -------------------- PRUNE DAILY CONTEXT -------------------- */
  if (STATE.dailyContext?.contexts?.length) {
    const now = Date.now();
    const before = STATE.dailyContext.contexts.length;

    STATE.dailyContext.contexts = STATE.dailyContext.contexts.filter(
      (c) => now - new Date(c.createdAt).getTime() <= RETENTION_MS
    );

    const after = STATE.dailyContext.contexts.length;
    if (before !== after) {
      console.log(`🧹 Pruned ${before - after} old dailyContext entries`);
    }
  }

  /* -------------------- FETCH & SELECT -------------------- */
  const items = await fetchCTRSS();
  console.log("ctNewsPollingLoop..3");
  if (!Array.isArray(items)) return;

  const sorted = items
    .filter(isCTArticle)
    .sort((a, b) => getPubDate(b) - getPubDate(a));

  let selected = null;
  console.log("ctNewsPollingLoop..4");

  for (const item of sorted) {
    const pubMs = getPubDate(item);
    if (!pubMs) continue;

    const ageMin = (Date.now() - pubMs) / 60000;
    if (ageMin > MAX_AGE_MIN) continue;

    const cleanLink = normalizeCTLink(item.link);
    if (STATE.cricktracker.seen[cleanLink]) continue;

    if (isBlockedCAHeadline(item.title)) {
      STATE.cricktracker.seen[cleanLink] = Date.now();
      console.log("⛔ CT utility headline blocked:", item.title);
      continue;
    }

    selected = item;
    break;
  }
  console.log("ctNewsPollingLoop..5");

  if (!selected) return;

  const cleanLink = normalizeCTLink(selected.link);

  /* -------------------- PARSE -------------------- */
  const parsed = parseCTArticle(selected);
  if (!parsed?.body || parsed.body.length < 80) return;

  /* -------------------- CONTEXT DEDUPE -------------------- */
  console.log("ctNewsPollingLoop..6");
  let decision = null;
  try {
    decision = await judgeNewsContext({
      articleText: `${parsed.headline}\n${parsed.body}`,
      existingContexts:
        STATE.dailyContext?.contexts?.map((c) => c.summary) || [],
    });

    if (decision?.isAlreadyCovered && decision.confidence >= 0.8) {
      console.log("🔴🔴 News neglected by CT because already covered 🔴🔴");
      STATE.cricktracker.seen[cleanLink] = Date.now();
      await saveState(STATE);
      return;
    }
  } catch (_) {}

  /* -------------------- GENERATE TWEET -------------------- */
  let tweetText;
  try {
    tweetText = await generateGeminiCAtweet(
      `${parsed.headline}\n${parsed.body}`
    );
  } catch {}

  if (!tweetText || tweetText.length < 30) {
    console.log("⚠️ CT tweet too short, skipping");
    STATE.cricktracker.seen[cleanLink] = Date.now();
    await saveState(STATE);
    return;
  }

  /* -------------------- IMAGE DECISION -------------------- */
  const imageUrl = getCTImageUrl(selected);
  STATE.usedImages ??= {};

  console.log("ctNewsPollingLoop..7");
  if (!CONSOLE_ONLY) {
    console.log("ctNewsPollingLoop..8");
    let useImage = false;

    if (imageUrl && !STATE.usedImages[imageUrl]) {
      try {
        const localPath = await downloadImageToTemp(imageUrl);
        const ocr = await isRiskyTwitterImage(localPath);

        if (!ocr.risky) {
          useImage = true;
        } else {
          console.log("⚠️ CT OCR flagged image:", ocr.reason);
        }
      } catch (err) {
        console.warn("⚠️ CT OCR failed:", err.message);
      }
    }

    if (!useImage && isBlockedCAHeadline(selected.title)) {
      console.log("⛔ CT duplicate image + utility headline — skipping");
      STATE.cricktracker.seen[cleanLink] = Date.now();
      await saveState(STATE);
      return;
    }
    // tweetText = `🚨 ${tweetText}`;
    console.log("🟦🟦 Tweet generated by CT 🟦🟦");
    console.log("tweetText:::", tweetText);
    console.log("imageUrl:::", imageUrl);

    if (useImage) {
      console.log("eligible for CT tweet with image");
      await tweetWithNativeImage({ text: tweetText, imageUrl });
      STATE.usedImages[imageUrl] = Date.now();
    } else {
      console.log("eligible for CT text-only tweet");
      await postTweet_ie_web({ text: tweetText });
    }
  }

  console.log("ctNewsPollingLoop..9");
  /* -------------------- SAVE CONTEXT -------------------- */
  if (decision?.newContext) {
    STATE.dailyContext ??= { contexts: [] };

    if (!contextExists(STATE, decision.newContext)) {
      STATE.dailyContext.contexts.push({
        summary: decision.newContext,
        source: "CT",
        link: cleanLink,
        createdAt: new Date().toISOString(),
      });
    } else {
      console.log("🧠 CT duplicate dailyContext skipped");
    }
  }

  STATE.cricktracker.seen[cleanLink] = Date.now();
  await saveState(STATE);
}

console.log("ctNewsPollingLoop..10");
/* -------------------- HELPERS -------------------- */

function getPubDate(item) {
  return item?.pubDate ? new Date(item.pubDate).getTime() : 0;
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
