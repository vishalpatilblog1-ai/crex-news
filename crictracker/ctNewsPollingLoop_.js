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

  if (!STATE.cricktracker) STATE.cricktracker = {};
  if (!STATE.cricktracker.seen) STATE.cricktracker.seen = {};

  const MAX_AGE_MIN = 200;
  const CONSOLE_ONLY = process.env.CONSOLE_ONLY === "true";
  const SEEN_RETENTION_HOURS = 48;
  const SEEN_RETENTION_MS = SEEN_RETENTION_HOURS * 60 * 60 * 1000;

  try {
    const now = Date.now();
    let pruned = 0;

    for (const [link, ts] of Object.entries(STATE.cricktracker.seen)) {
      if (now - ts > SEEN_RETENTION_MS) {
        delete STATE.cricktracker.seen[link];
        pruned++;
      }
    }

    if (pruned > 0) {
      console.log(`🧹 Pruned ${pruned} old CT seen entries`);
    }
  } catch (err) {
    console.warn("⚠️ CT seen prune failed:", err.message);
  }

  const items = await fetchCTRSS();
  if (!Array.isArray(items)) return;

  console.log("ctNewsPollingLoop..1");

  const sorted = items
    .filter(isCTArticle)
    .sort((a, b) => getPubDate(b) - getPubDate(a));

  let selected = null;

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

  if (!selected) return;

  /* -------------------- PARSE ARTICLE -------------------- */
  const parsed = parseCTArticle(selected);
  if (!parsed?.body || parsed.body.length < 80) return;

  /* -------------------- CONTEXT DEDUPE -------------------- */
  let decision = null;
  try {
    decision = await judgeNewsContext({
      //   articleText: parsed.body,
      articleText: `${parsed.headline}\n${parsed.body}`,
      existingContexts:
        STATE.dailyContext?.contexts?.map((c) => c.summary) || [],
    });

    // if (decision?.isAlreadyCovered && decision.confidence >= 0.8) {
    if (decision?.isAlreadyCovered && decision.confidence >= 0.8) {
      console.log("🔴 news neglected because already covered");
      STATE.cricktracker.seen[normalizeCTLink(selected.link)] = Date.now();
      await saveState(STATE);
      return;
    }
  } catch (_) {}

  /* -------------------- GENERATE TWEET -------------------- */
  let tweetText;
  try {
    tweetText = await generateGeminiCAtweet(
      parsed.headline + "\n" + parsed.body
    );
  } catch {}

  if (!tweetText || tweetText.length < 30) {
    console.log("⚠️ CT tweet too short, skipping");
    STATE.cricktracker.seen[normalizeCTLink(selected.link)] = Date.now();
    await saveState(STATE);
    return;
  }

  const imageUrl = getCTImageUrl(selected);
  const cleanLink = normalizeCTLink(selected.link);

  console.log("imageUrl::", imageUrl);
  console.log("cleanLink::", cleanLink);

  if (!STATE.usedImages) STATE.usedImages = {};

  /* -------------------- IMAGE / TEXT DECISION -------------------- */
  if (!CONSOLE_ONLY) {
    console.log("ready for web..");
    let useImage = false;

    if (imageUrl) {
      if (STATE.usedImages[imageUrl]) {
        console.log("🖼️ CT image already used — forcing text-only");
      } else {
        try {
          const localImagePath = await downloadImageToTemp(imageUrl);
          const ocrResult = await isRiskyTwitterImage(localImagePath);

          if (!ocrResult.risky) {
            useImage = true;
          } else {
            console.log("⚠️ CT OCR flagged image:", ocrResult.reason);
          }
        } catch (err) {
          console.warn("⚠️ CT OCR failed, fallback to text-only:", err.message);
        }
      }
    }

    if (!useImage && isBlockedCAHeadline(selected.title)) {
      console.log("⛔ CT duplicate image + utility headline — skipping");
      STATE.cricktracker.seen[cleanLink] = Date.now();
      await saveState(STATE);
      return;
    }

    if (useImage) {
      console.log("eligible for CT tweet with image");
      //   await tweetWithNativeImage({ text: tweetText, imageUrl });
      STATE.usedImages[imageUrl] = Date.now();
    } else {
      console.log("eligible for CT text-only tweet");
      //   await postTweet_ie_web({ text: tweetText });
    }
  }

  /* -------------------- SAVE CONTEXT -------------------- */
  if (decision?.newContext) {
    if (!STATE.dailyContext) {
      STATE.dailyContext = {
        date: new Date().toISOString().slice(0, 10),
        contexts: [],
      };
    }

    STATE.dailyContext.contexts.push({
      summary: decision.newContext,
      source: "CT",
      link: cleanLink,
      createdAt: new Date().toISOString(),
    });
  }

  STATE.cricktracker.seen[cleanLink] = Date.now();
  await saveState(STATE);
}

function getPubDate(item) {
  return item?.pubDate ? new Date(item.pubDate).getTime() : 0;
}
