import {
  classifyArticle,
  generateGPTTweetWithType,
} from "../ai/generate-gpt-tweet.js";

// import { generateClaudeTweetWithType } from "../ai/generateClaudeTweet.js";

import { generateCardImage } from "../canvas/imageRenderer.js";

import { judgeNewsContext } from "../indian-express/ai/judgeNewsContext.js";

import {
  applySourceSignature,
  enqueueTweet,
  isCricketAddictorBlocked,
} from "../twitter/tweetQueue.js";

import { CREX_BASE_IMAGE_TEMPLATE } from "../utils/config.js";
import { saveState } from "../utils/stateStoreCloud.js";

import { fetchSKCricketFeed } from "./fetchSKCricketFeed.js";
import { resolveGoogleNewsUrl } from "./resolveGoogleNewsUrl.js";

import { isSportskeedaCricketArticle, normalizeSKLink } from "./skFilters.js";

import { isBlockedSKHeadline } from "./skHeadlineFilter.js";
import { parseSKArticle } from "./parseSKArticle.js";

import { isRiskyTwitterImage } from "./ocr/detectTwitterReference.js";
import { downloadImageToTemp } from "./ocr/downloadImageToTemp.js";

const MAX_AGE_MIN = 120;
const CONSOLE_ONLY = process.env.CONSOLE_ONLY === "true";
const RETENTION_MS = 6 * 60 * 60 * 1000;
const SEEN_RETENTION_MS = 24 * 60 * 60 * 1000;

// SK's article-page fetch has turned out to be intermittently blocked (405
// on some articles, clean success on others -- not a hard 100% block). The
// old version picked exactly one candidate per cycle and gave up the whole
// cycle if that one failed, wasting a full 2-minute poll on a single flaky
// URL even when the other ~49 items in the same RSS batch were untouched
// and possibly fine. This caps how many candidates get a real attempt
// (parse + classify + context + generate) before the cycle gives up --
// cheap pre-filtering (age/seen/blocked-headline/resolve) doesn't count
// against this, only genuine parse attempts do.
const MAX_CANDIDATES_PER_CYCLE = 5;

export async function skNewsPollingLoop() {
  console.log("skNewsPollingLoop...");

  if (!global.STATE) {
    console.log("⚠️ global.STATE is not available");
    return false;
  }

  if (isCricketAddictorBlocked("SK")) {
    console.log("🚫 Sportskeeda polling paused during blocked hours");

    return false;
  }

  const STATE = global.STATE;

  STATE.sk ??= {};
  STATE.sk.seen ??= {};
  STATE.dailyContext ??= {
    contexts: [],
  };
  STATE.dailyContext.contexts ??= [];
  STATE.usedImages ??= {};

  let stateChanged = false;

  if (pruneSeen(STATE)) {
    stateChanged = true;
  }

  if (pruneDailyContext(STATE)) {
    stateChanged = true;
  }

  if (pruneUsedImages(STATE)) {
    stateChanged = true;
  }

  if (stateChanged) {
    await saveState(STATE, "Sportskeeda state cleanup");
  }

  let items = [];

  try {
    items = await fetchSKCricketFeed({
      limit: 50,
    });
  } catch (error) {
    console.log("❌ Sportskeeda RSS fetch failed:", error?.message || error);

    return false;
  }

  if (!Array.isArray(items) || items.length === 0) {
    console.log("ℹ️ No Sportskeeda RSS items found");

    return false;
  }

  console.log(`📰 Sportskeeda RSS items: ${items.length}`);

  const sorted = [...items]
    .filter((item) => getPubDate(item))
    .sort((a, b) => getPubDate(b) - getPubDate(a));

  let attemptsUsed = 0;

  for (const item of sorted) {
    if (attemptsUsed >= MAX_CANDIDATES_PER_CYCLE) {
      console.log(
        `ℹ️ Reached ${MAX_CANDIDATES_PER_CYCLE} candidate attempts this cycle, stopping.`,
      );
      break;
    }

    const publishedAt = getPubDate(item);

    const ageMinutes = (Date.now() - publishedAt) / 60000;

    if (ageMinutes > MAX_AGE_MIN) {
      continue;
    }

    const googleNewsLink = item.googleNewsLink || item.link || item.guid;

    if (!googleNewsLink) {
      continue;
    }

    const googleNewsSeenKey = `google-news:${googleNewsLink}`;

    if (STATE.sk.seen[googleNewsSeenKey]) {
      continue;
    }

    if (isBlockedSKHeadline(item.title || item.headline || "")) {
      STATE.sk.seen[googleNewsSeenKey] = Date.now();

      continue;
    }

    let resolvedLink = null;

    try {
      resolvedLink = await resolveGoogleNewsUrl(googleNewsLink);
    } catch (error) {
      console.log("⚠️ Google News URL decode failed:", error?.message || error);

      continue;
    }

    if (!resolvedLink) {
      console.log("⏭️ Could not resolve Sportskeeda article:", googleNewsLink);

      continue;
    }

    const cleanLink = normalizeSKLink(resolvedLink);

    if (!cleanLink) {
      console.log("⏭️ Invalid resolved Sportskeeda URL:", resolvedLink);

      continue;
    }

    if (
      !isSportskeedaCricketArticle({
        link: cleanLink,
      })
    ) {
      console.log("⏭️ Not a valid Sportskeeda cricket article:", cleanLink);

      continue;
    }

    if (STATE.sk.seen[cleanLink]) {
      STATE.sk.seen[googleNewsSeenKey] = Date.now();

      continue;
    }

    console.log("✅ Sportskeeda URL resolved:", {
      googleNewsLink,
      resolvedLink,
      cleanLink,
    });

    const selectedItem = {
      ...item,
      link: cleanLink,
      googleNewsLink,
    };

    // Everything from here on is a genuine attempt -- counts against the cap.
    attemptsUsed += 1;

    const result = await attemptSportskeedaTweet(
      STATE,
      selectedItem,
      cleanLink,
    );

    if (result === "success") {
      return true;
    }

    // result === "retry-later" (transient fetch failure, e.g. the
    // intermittent 405) or "skip" (blocked/duplicate/generation failure) --
    // either way, move on to the next candidate in this same cycle instead
    // of ending the whole poll on one bad article.
  }

  console.log("ℹ️ No Sportskeeda tweet produced this cycle");

  return false;
}

// Runs the full parse -> classify -> context -> generate -> queue pipeline
// for one candidate. Returns "success", "retry-later" (don't mark seen --
// this URL might work on a future poll), or "skip" (mark seen -- retrying
// won't help, e.g. blocked content or a genuine duplicate).
async function attemptSportskeedaTweet(STATE, selectedItem, cleanLink) {
  try {
    const parsed = await parseSKArticle(selectedItem);

    if (!parsed?.headline || !parsed?.body) {
      console.log("⏭️ Sportskeeda article parsing failed:", cleanLink);

      // Deliberately NOT marked seen -- SK's article-page block has turned
      // out to be intermittent, not absolute (same URL has failed then
      // succeeded on different polls). Throwing this away permanently would
      // discard a URL that might work fine on the very next cycle.
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
        `📊 Scores — significance: ${
          decision?.significanceScore ?? "n/a"
        }, virality: ${
          decision?.viralityScore ?? "n/a"
        } — "${parsed.headline}"`,
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
      // const claudeResult = await generateClaudeTweetWithType(
      //   fullText,
      //   articleType,
      // );
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

    if (!/[.!?]$/.test(tweetText)) {
      tweetText += ".";
    }

    if (CONSOLE_ONLY) {
      console.log("🧪 CONSOLE_ONLY Sportskeeda tweet:", {
        headline: parsed.headline,
        articleUrl: cleanLink,
        tweetText,
        generatedPath,
        articleImage: imageUrl,
        useArticleImage: imageResult.useImage,
      });

      return "skip";
    }

    enqueueTweet({
      id: `SK:${cleanLink}`,
      source: "SK",
      text: tweetText,
      imageUrl: generatedPath || null,
      seenKey: cleanLink,
      publishedAt: getPubDate(selectedItem) || Date.now(),
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

    return "retry-later";
  }
}

function getPubDate(item) {
  const value = item?.publishedAt || item?.isoDate || item?.pubDate;

  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();

  return Number.isFinite(timestamp) ? timestamp : 0;
}

function markSeen(STATE, item, cleanLink) {
  const now = Date.now();

  if (cleanLink) {
    STATE.sk.seen[cleanLink] = now;
  }

  const googleNewsLink = item?.googleNewsLink || item?.link || item?.guid;

  if (googleNewsLink) {
    STATE.sk.seen[`google-news:${googleNewsLink}`] = now;
  }
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
  if (!imageUrl) {
    return {
      useImage: false,
    };
  }

  if (usedImages[imageUrl]) {
    return {
      useImage: false,
    };
  }

  try {
    const localImagePath = await downloadImageToTemp(imageUrl);

    const result = await isRiskyTwitterImage(localImagePath);

    return {
      useImage: !result?.risky,
    };
  } catch (error) {
    console.log("⚠️ Sportskeeda image check failed:", error?.message || error);

    return {
      useImage: false,
    };
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
