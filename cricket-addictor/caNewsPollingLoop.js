// cricket-addictor/caNewsPollingLoop.js

import { judgeNewsContext } from "../indian-express/ai/judgeNewsContext.js";
import { tweetWithNativeImage } from "../twitter/tweetWithImage.js";
import { postTweet_ie_web } from "../twitter/twitter.js";
import { saveState } from "../utils/stateStoreCloud.js";
import { generateGeminiCAtweet } from "./ai/generateGeminiCAtweet.js";
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
  if (!STATE.ca) STATE.ca = {};
  if (!STATE.ca.seen) STATE.ca.seen = {};

  const MAX_AGE_MIN = 25;
  const CONSOLE_ONLY = process.env.CONSOLE_ONLY === "true";
  const SEEN_RETENTION_HOURS = 6;
  const SEEN_RETENTION_MS = SEEN_RETENTION_HOURS * 60 * 60 * 1000;
  const CONTEXT_RETENTION_HOURS = 6;
  const CONTEXT_RETENTION_MS = CONTEXT_RETENTION_HOURS * 60 * 60 * 1000;
  try {
    const now = Date.now();
    let pruned = 0;

    for (const [link, ts] of Object.entries(STATE.ca.seen)) {
      if (now - ts > SEEN_RETENTION_MS) {
        delete STATE.ca.seen[link];
        pruned++;
      }
    }

    if (pruned > 0) {
      console.log(`🧹 Pruned ${pruned} old CA seen entries`);
    }
  } catch (err) {
    console.warn("⚠️ CA seen prune failed:", err.message);
  }

  if (STATE.dailyContext?.contexts?.length) {
    const now = Date.now();
    const before = STATE.dailyContext.contexts.length;

    STATE.dailyContext.contexts = STATE.dailyContext.contexts.filter(
      (c) => now - new Date(c.createdAt).getTime() <= CONTEXT_RETENTION_MS
    );

    const after = STATE.dailyContext.contexts.length;

    if (before !== after) {
      console.log(`🧹 Pruned ${before - after} old dailyContext entries`);
    }
  }

  const items = await fetchCARSS();

  if (!Array.isArray(items)) return;

  const sorted = items
    .filter(isCAArticle)
    .sort((a, b) => getPubDate(b) - getPubDate(a));

  let selected = null;

  for (const item of sorted) {
    const pubMs = getPubDate(item);
    if (!pubMs) {
      continue;
    }

    const ageMin = (Date.now() - pubMs) / 60000;
    if (ageMin > MAX_AGE_MIN) {
      continue;
    }

    const cleanLink = normalizeCALink(item.link);
    if (STATE.ca.seen[cleanLink]) {
      continue;
    }

    if (isBlockedCAHeadline(item.title)) {
      STATE.ca.seen[cleanLink] = Date.now();
      console.log("⛔ skipped utility headline really blocked:", item.title);
      continue;
    }

    selected = item;
    break;
  }

  if (!selected) return;
  const cleanLink = normalizeCALink(selected.link);
  const parsed = parseCAArticle(selected);
  if (!parsed?.body || parsed.body.length < 80) return;

  let decision = null;
  try {
    decision = await judgeNewsContext({
      articleText: `${parsed.headline}\n${parsed.body}`,
      existingContexts:
        STATE.dailyContext?.contexts?.map((c) => c.summary) || [],
    });
    if (decision?.isAlreadyCovered && decision.confidence >= 0.8) {
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
        console.log("⚠️ matchedIndex missing or out of bounds:", decision);
      }

      STATE.ca.seen[normalizeCALink(selected.link)] = Date.now();
      await saveState(STATE);
      return;
    }

    // if (decision?.isAlreadyCovered && decision.confidence >= 0.8) {
    //   console.log("🔴🔴 News neglected by CA because already covered 🔴🔴");
    //   STATE.ca.seen[normalizeCALink(selected.link)] = Date.now();
    //   await saveState(STATE);
    //   return;
    // }
  } catch (_) {}

  let tweetText;
  try {
    tweetText = await generateGeminiCAtweet(
      parsed.headline + "\n" + parsed.body
    );
  } catch {
    console.log("could be error..");
  }

  if (!tweetText || tweetText.length < 30) {
    console.log("⚠️ Tweet text too short, skipping");
    STATE.ca.seen[cleanLink] = Date.now();
    await saveState(STATE);
    return;
  }
  const imageUrl = getCAImageUrl(selected);

  if (!STATE.usedImages) STATE.usedImages = {};
  if (!CONSOLE_ONLY) {
    let useImage = false;

    if (imageUrl) {
      if (STATE.usedImages[imageUrl]) {
        console.log("🖼️ Image already used — forcing text-only");
        useImage = false;
      } else {
        try {
          const localImagePath = await downloadImageToTemp(imageUrl);
          const ocrResult = await isRiskyTwitterImage(localImagePath);

          console.log("localImagePath::", localImagePath);
          console.log("ocrResult::", ocrResult);
          if (!ocrResult.risky) {
            useImage = true;
          } else {
            console.log("⚠️ OCR flagged image as risky:", ocrResult.reason);
          }
        } catch (err) {
          console.warn(
            "⚠️ OCR check failed, fallback to text-only:",
            err.message
          );
        }
      }
    }

    if (!useImage && isBlockedCAHeadline(selected.title)) {
      console.log("⛔ Duplicate image + utility headline — skipping");
      STATE.ca.seen[cleanLink] = Date.now();
      await saveState(STATE);
      return;
    }

    if (useImage) {
      console.log("eligible for text with image");
      await tweetWithNativeImage({ text: tweetText, imageUrl });
      STATE.usedImages[imageUrl] = Date.now();
    } else {
      console.log("eligible for only text");
      await postTweet_ie_web({ text: tweetText });
    }
  }
  if (decision?.newContext) {
    if (!STATE.dailyContext) {
      STATE.dailyContext ??= { contexts: [] };
    }

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

  STATE.ca.seen[cleanLink] = Date.now();
  await saveState(STATE);
}

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

// function contextExists(STATE, summary) {
//   const norm = normalizeSummary(summary);
//   return STATE.dailyContext.contexts.some(
//     (c) => normalizeSummary(c.summary) === norm
//   );
// }
