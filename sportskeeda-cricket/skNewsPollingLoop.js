
import {
  classifyArticle,
  generateGPTTweetWithType,
} from "../ai/generate-gpt-tweet.js";
import { generateCardImage } from "../canvas/imageRenderer.js";
import { judgeNewsContext } from "../indian-express/ai/judgeNewsContext.js";
import {
  applySourceSignature,
  enqueueTweet,
  isCricketAddictorBlocked,
  isQuietHoursBlocked,
} from "../twitter/tweetQueue.js";
import { CREX_BASE_IMAGE_TEMPLATE } from "../utils/config.js";
import { saveState } from "../utils/stateStoreCloud.js";
import { fetchSKCricketListing } from "./fetchSKCricketListing.js";
import { isSportskeedaCricketArticle, normalizeSKLink } from "./skFilters.js";
import { isBlockedSKHeadline } from "./skHeadlineFilter.js";
import { parseSKArticle } from "./parseSKArticle.js";
import { isRiskyTwitterImage } from "./ocr/detectTwitterReference.js";
import { downloadImageToTemp } from "./ocr/downloadImageToTemp.js";

const USE_WEB_TWEET = process.env.USE_WEB_TWEET === "true";
const RETENTION_MS = 6 * 60 * 60 * 1000;
const SEEN_RETENTION_MS = 24 * 60 * 60 * 1000;
const IGNORE_SEEN = process.env.SK_IGNORE_SEEN === "true";
const MAX_CANDIDATES_PER_CYCLE = 5;
const MAX_AGE_MIN = Number(process.env.SK_MAX_AGE_MIN || 60);

export async function skNewsPollingLoop() {
  console.log("skNewsPollingLoop...");

  if (IGNORE_SEEN && USE_WEB_TWEET) {
    console.log(
      "🚨 SK_IGNORE_SEEN is true WITH USE_WEB_TWEET also true — this can re-post an already-tweeted article live. Leave USE_WEB_TWEET unset/false unless this is intentional.",
    );
  }

  if (!global.STATE) {
    console.log("⚠️ global.STATE is not available");
    return false;
  }

  if (isQuietHoursBlocked("SK")) {
    console.log(
      "🚫 Sportskeeda polling paused during quiet hours (1-5 AM IST)",
    );
    return false;
  }

  const STATE = global.STATE;
  STATE.sk ??= {};
  STATE.sk.seen ??= {};
  STATE.dailyContext ??= { contexts: [] };
  STATE.dailyContext.contexts ??= [];
  STATE.usedImages ??= {};
  STATE.sk.failureStats ??= {
    scrappey_proxy: 0,
    sk_waf_block: 0,
    timeout: 0,
    other: 0,
  };

  let stateChanged = false;
  if (pruneSeen(STATE)) stateChanged = true;
  if (pruneDailyContext(STATE)) stateChanged = true;
  if (pruneUsedImages(STATE)) stateChanged = true;
  if (stateChanged) await saveState(STATE, "Sportskeeda state cleanup");

  let candidates = [];

  try {
    const result = await fetchSKCricketListing();
    candidates = result.candidates;

    for (const failure of result.failures) {
      STATE.sk.failureStats[failure.category] =
        (STATE.sk.failureStats[failure.category] || 0) + 1;
    }

    if (result.failures.length > 0) {
      console.log("📊 SK failure tally so far:", STATE.sk.failureStats);
    }
  } catch (error) {
    console.log(
      "❌ Sportskeeda listing fetch failed:",
      error?.message || error,
    );
    return false;
  }

  if (!Array.isArray(candidates) || candidates.length === 0) {
    console.log("ℹ️ No Sportskeeda articles found on listing pages");
    return false;
  }

  console.log(`📰 Sportskeeda candidates found: ${candidates.length}`);

  let attemptsUsed = 0;

  for (const candidate of candidates) {
    if (attemptsUsed >= MAX_CANDIDATES_PER_CYCLE) {
      console.log(
        `ℹ️ Reached ${MAX_CANDIDATES_PER_CYCLE} candidate attempts this cycle, stopping.`,
      );
      break;
    }

    if (isBlockedSKHeadline(candidate.headline || "")) {
      console.log("⏭️ SK headline blocked:", candidate.headline);
      continue;
    }
    if (candidate.ageMinutes !== null && candidate.ageMinutes > MAX_AGE_MIN) {
      console.log(
        `⏭️ SK candidate too old (${candidate.ageMinutes}min > ${MAX_AGE_MIN}min):`,
        candidate.headline,
      );
      continue;
    }

    const cleanLink = normalizeSKLink(candidate.link);

    if (!cleanLink) {
      console.log("⏭️ Invalid Sportskeeda URL:", candidate.link);
      continue;
    }

    if (!isSportskeedaCricketArticle({ link: cleanLink })) {
      console.log("⏭️ Not a valid Sportskeeda cricket article:", cleanLink);
      continue;
    }

    if (!IGNORE_SEEN && STATE.sk.seen[cleanLink]) {
      console.log("⏭️ SK already seen:", cleanLink);
      continue;
    }

    const selectedItem = { link: cleanLink, headline: candidate.headline };

    attemptsUsed += 1;

    const result = await attemptSportskeedaTweet(
      STATE,
      selectedItem,
      cleanLink,
    );

    if (result === "success") return true;
  }

  console.log("ℹ️ No Sportskeeda tweet produced this cycle");
  return false;
}

async function attemptSportskeedaTweet(STATE, selectedItem, cleanLink) {
  try {
    const parsed = await parseSKArticle(selectedItem);

    if (!parsed?.headline || !parsed?.body) {
      console.log("⏭️ Sportskeeda article parsing failed:", cleanLink);
      await saveState(STATE, "Sportskeeda parsing failed (retry later)");
      return "retry-later";
    }

    const fullText = `${parsed.headline}\n${parsed.body}`;

    if (isBlockedSKHeadline(parsed.headline)) {
      console.log("⏭️ Blocked Sportskeeda article:", parsed.headline);
      markSeen(STATE, selectedItem, cleanLink);
      await saveState(STATE, "Sportskeeda blocked article");
      return "skip";
    }

    let articleType = "player_form";

    try {
      articleType = await classifyArticle(fullText);
    } catch (error) {
      console.log(
        "⚠️ Sportskeeda article classification failed:",
        error?.message || error,
      );
    }

    let decision = null;

    try {
      decision = await judgeNewsContext({
        articleText: fullText,
        existingContexts: STATE.dailyContext.contexts.map(
          (context) => context.summary,
        ),
      });

      console.log(
        `📊 Scores — significance: ${decision?.significanceScore ?? "n/a"}, virality: ${decision?.viralityScore ?? "n/a"} — "${parsed.headline}"`,
      );

      if (decision?.isAlreadyCovered && decision?.confidence >= 0.8) {
        console.log("🔴 Sportskeeda article already covered");
        markSeen(STATE, selectedItem, cleanLink);
        await saveState(STATE, "Sportskeeda duplicate context");
        return "skip";
      }
    } catch (error) {
      console.log(
        "⚠️ Sportskeeda context check failed:",
        error?.message || error,
      );
    }

    let tweetText = null;
    let generatedPath = null;

    try {
      const claudeResult = await generateGPTTweetWithType(
        fullText,
        articleType,
      );
      tweetText = claudeResult?.tweetText || null;

      if (claudeResult?.card) {
        generatedPath = await generateCardImage(
          CREX_BASE_IMAGE_TEMPLATE,
          claudeResult.card,
        );
        console.log("🖼️ Claude Sportskeeda card generated:", generatedPath);
      } else {
        console.log("📝 Claude generated text-only tweet");
      }
    } catch (error) {
      console.log(
        "⚠️ Claude Sportskeeda generation failed:",
        error?.message || error,
      );
    }

    if (!tweetText) {
      try {
        const gptResult = await generateGPTTweetWithType(fullText, articleType);
        tweetText = gptResult?.tweetText || null;

        if (gptResult?.card) {
          generatedPath = await generateCardImage(
            CREX_BASE_IMAGE_TEMPLATE,
            gptResult.card,
          );
          console.log("🖼️ GPT Sportskeeda card generated:", generatedPath);
        } else {
          console.log("📝 GPT generated text-only tweet");
        }
      } catch (error) {
        console.log(
          "⚠️ GPT Sportskeeda generation failed:",
          error?.message || error,
        );
      }
    }

    if (!tweetText) {
      console.log("⏭️ Sportskeeda tweet generation failed");
      markSeen(STATE, selectedItem, cleanLink);
      await saveState(STATE, "Sportskeeda tweet generation failed");
      return "skip";
    }

    const imageUrl = parsed.imageUrl || null;
    const imageResult = await decideImageUsage(imageUrl, STATE.usedImages);

    tweetText = applySourceSignature(tweetText, "SK");
    tweetText = tweetText.trim();
    if (!/[.!?]$/.test(tweetText)) tweetText += ".";

    if (!USE_WEB_TWEET) {
      console.log(
        "🧪 USE_WEB_TWEET is false — logging Sportskeeda tweet instead of posting:",
        {
          headline: parsed.headline,
          articleUrl: cleanLink,
          tweetText,
          generatedPath,
          articleImage: imageUrl,
          useArticleImage: imageResult.useImage,
        },
      );
      return "skip";
    }

    enqueueTweet({
      id: `SK:${cleanLink}`,
      source: "SK",
      text: tweetText,
      imageUrl: generatedPath || null,
      seenKey: cleanLink,
      publishedAt: Date.now(),
    });

    console.log(`📥 Queued Sportskeeda tweet: ${parsed.headline}`);
    markSeen(STATE, selectedItem, cleanLink);

    if (imageResult.useImage && imageUrl) {
      STATE.usedImages[imageUrl] = Date.now();
    }

    if (decision?.newContext && !contextExists(STATE, decision.newContext)) {
      STATE.dailyContext.contexts.push({
        summary: decision.newContext,
        source: "SK",
        link: cleanLink,
        createdAt: new Date().toISOString(),
      });
    }

    await saveState(STATE, "Sportskeeda tweet queued");
    console.log(`✅ Sportskeeda processed: ${parsed.headline}`);
    return "success";
  } catch (error) {
    console.log("⚠️ Sportskeeda processing failed:", error?.message || error);
    const category = error?.category || "other";
    STATE.sk.failureStats[category] =
      (STATE.sk.failureStats[category] || 0) + 1;
    return "retry-later";
  }
}

function markSeen(STATE, item, cleanLink) {
  if (cleanLink) STATE.sk.seen[cleanLink] = Date.now();
}

function pruneSeen(STATE) {
  const now = Date.now();
  let changed = false;
  for (const [key, timestamp] of Object.entries(STATE.sk.seen)) {
    if (now - timestamp > SEEN_RETENTION_MS) {
      delete STATE.sk.seen[key];
      changed = true;
    }
  }
  return changed;
}

function pruneDailyContext(STATE) {
  const before = STATE.dailyContext.contexts.length;
  STATE.dailyContext.contexts = STATE.dailyContext.contexts.filter(
    (context) => {
      const timestamp = new Date(context.createdAt).getTime();
      return (
        Number.isFinite(timestamp) && Date.now() - timestamp <= RETENTION_MS
      );
    },
  );
  return before !== STATE.dailyContext.contexts.length;
}

function pruneUsedImages(STATE) {
  const now = Date.now();
  let changed = false;
  for (const [imageUrl, timestamp] of Object.entries(STATE.usedImages)) {
    if (now - timestamp > RETENTION_MS) {
      delete STATE.usedImages[imageUrl];
      changed = true;
    }
  }
  return changed;
}

async function decideImageUsage(imageUrl, usedImages) {
  if (!imageUrl) return { useImage: false };
  if (usedImages[imageUrl]) return { useImage: false };

  try {
    const localImagePath = await downloadImageToTemp(imageUrl);
    const result = await isRiskyTwitterImage(localImagePath);
    return { useImage: !result?.risky };
  } catch (error) {
    console.log("⚠️ Sportskeeda image check failed:", error?.message || error);
    return { useImage: false };
  }
}

function contextExists(STATE, summary) {
  const normalized = normalizeText(summary);
  return STATE.dailyContext.contexts.some(
    (context) => normalizeText(context.summary) === normalized,
  );
}

function normalizeText(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
