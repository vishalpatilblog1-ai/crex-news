// cricket-addictor/caNewsPollingLoop.js

import { judgeNewsContext } from "../indian-express/ai/judgeNewsContext.js";
import { tweetWithNativeImage } from "../twitter/tweetWithImage.js";
import { postTweet_ie_web } from "../twitter/twitter.js";
import { saveState } from "../utils/stateStoreCloud.js";
import { generateGeminiCAtweet } from "./ai/generateGeminiCAtweet.js";
import { isCAArticle, normalizeCALink } from "./caFilters.js";
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

  const MAX_AGE_MIN = 15;
  const CONSOLE_ONLY = process.env.CONSOLE_ONLY === "true";
  const SEEN_RETENTION_HOURS = 48;
  const SEEN_RETENTION_MS = SEEN_RETENTION_HOURS * 60 * 60 * 1000;

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

  const items = await fetchCARSS();

  if (!Array.isArray(items)) return;

  const sorted = items
    .filter(isCAArticle)
    .sort((a, b) => getPubDate(b) - getPubDate(a));

  let selected = null;

  for (const item of sorted) {
    const pubMs = getPubDate(item);
    if (!pubMs) {
      console.log("⛔ skip: no pubDate");
      continue;
    }

    const ageMin = (Date.now() - pubMs) / 60000;
    if (ageMin > MAX_AGE_MIN) {
      //   console.log("⛔ skip: too old", ageMin.toFixed(1), "min");
      continue;
    }

    const cleanLink = normalizeCALink(item.link);
    if (STATE.ca.seen[cleanLink]) {
      continue;
    }

    // console.log("✅ SELECTED:", item.title);
    selected = item;
    break;
  }

  //   console.log("selected::", selected);

  if (!selected) return;

  const parsed = parseCAArticle(selected);
  if (!parsed?.body || parsed.body.length < 80) return;

  // 🧠 Context dedupe
  try {
    const decision = await judgeNewsContext({
      articleText: parsed.body,
      existingContexts:
        STATE.dailyContext?.contexts?.map((c) => c.summary) || [],
    });

    // console.log("decision::", decision);

    if (decision?.isAlreadyCovered && decision.confidence >= 0.8) {
      STATE.ca.seen[normalizeCALink(selected.link)] = Date.now();
      await saveState(STATE);
      return;
    }
  } catch (_) {}

  let tweetText;
  try {
    tweetText = await generateGeminiCAtweet(
      parsed.headline + "\n" + parsed.body
    );
  } catch {
    // tweetText = generateCAFallbackTweet(selected);
  }

  const imageUrl = getCAImageUrl(selected);
  const cleanLink = normalizeCALink(selected.link);

  console.log("imageUrl::", imageUrl);
  console.log("cleanLink::", cleanLink);

  // if (!CONSOLE_ONLY) {
  //   if (imageUrl) {
  //     await tweetWithNativeImage({ text: tweetText, imageUrl });
  //   } else {
  //     await postTweet_ie_web({ text: tweetText });
  //   }
  // }
  if (!CONSOLE_ONLY) {
    let useImage = false;

    if (imageUrl) {
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

    if (useImage) {
      console.log("eligible for text with image");
      await tweetWithNativeImage({ text: tweetText, imageUrl });
    } else {
      console.log("eligible for only text");
      await postTweet_ie_web({ text: tweetText });
    }
  }

  STATE.ca.seen[cleanLink] = Date.now();
  await saveState(STATE);
}

function getPubDate(item) {
  return item?.pubDate ? new Date(item.pubDate).getTime() : 0;
}
