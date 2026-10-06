// sportskeeda-cricket/skNewsPollingLoop.js
//
// Aligned with CB / CA / ESPN / NDTV / Hindu / IE:
//  - GPT classify + GPT judge (a dropped article never costs a Claude call)
//  - POST_VIA_API flag: true  = score >= 7 -> X API, score < 7 -> WhatsApp
//                       false = score >= 7 -> WhatsApp, score < 7 dropped
//  - Claude tweet (with SOURCE + long-tweet flag), GPT fallback
//  - applySourceSignature, same score / virality logging
//
// Player photo / article image work (Cloudinary, OCR) only runs when the tweet
// goes to the X API queue. WhatsApp drafts are text only.
// USE_WEB_TWEET is handled centrally in tweetQueue.js, same as every other source.

import {
  classifyArticleGPT,
  generateGPTTweetWithType,
} from "../ai/generate-gpt-tweet.js";
import {
  generateClaudeTweetWithType,
  isLongTweetEligible,
  SIGNIFICANCE_EXEMPT_TYPES,
} from "../ai/generateClaudeTweet.js";
import { judgeNewsContextGPT } from "../ai/judgeNewsContextGPT.js";
import { applySourceSignature, enqueueTweet } from "../twitter/tweetQueue.js";
import { saveState } from "../utils/stateStoreCloud.js";
import { sendTweetDraftToWhatsApp } from "../utils/whatsappSender.js";
import { getPlayerImageUrl } from "./cloudinaryPlayerImage.js";
import { fetchSKCricketListing } from "./fetchSKCricketListing.js";
import { downloadImageToTemp } from "./ocr/downloadImageToTemp.js";
import { isRiskyTwitterImage } from "./ocr/detectTwitterReference.js";
import { parseSKArticle } from "./parseSKArticle.js";
import { isSportskeedaCricketArticle, normalizeSKLink } from "./skFilters.js";
import { isBlockedSKHeadline } from "./skHeadlineFilter.js";

const SOURCE = "SK";
const USE_WEB_TWEET = process.env.USE_WEB_TWEET === "true";
const RETENTION_MS = 6 * 60 * 60 * 1000; // usedImages prune window
// How long the shared "already covered" story memory lasts (hours, from env; default 6).
const CONTEXT_TTL_MS =
  (Number(process.env.CONTEXT_TTL_HOURS) > 0
    ? Number(process.env.CONTEXT_TTL_HOURS)
    : 6) *
  60 *
  60 *
  1000;
const SEEN_RETENTION_MS = 24 * 60 * 60 * 1000;
const IGNORE_SEEN = process.env.SK_IGNORE_SEEN === "true";
const MAX_CANDIDATES_PER_CYCLE = 5;
const MAX_AGE_MIN = 120;

// true  = score >= 7 -> X API, score < 7 -> WhatsApp (current flow)
// false = score >= 7 -> WhatsApp, score < 7 dropped (cutover; you post manually)
const POST_VIA_API = process.env.POST_VIA_API !== "false";

export async function skNewsPollingLoop() {
  if (IGNORE_SEEN && USE_WEB_TWEET) {
    console.log(
      "🚨 SK_IGNORE_SEEN is true WITH USE_WEB_TWEET also true — this can re-post an already-tweeted article live. Leave USE_WEB_TWEET unset/false unless this is intentional.",
    );
  }

  if (!global.STATE) {
    console.log("⚠️ global.STATE is not available");
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
  let queuedCount = 0;

  for (const candidate of candidates) {
    if (attemptsUsed >= MAX_CANDIDATES_PER_CYCLE) {
      console.log(
        `ℹ️ Reached ${MAX_CANDIDATES_PER_CYCLE} candidate attempts this cycle, stopping.`,
      );
      break;
    }

    if (isBlockedSKHeadline(candidate.headline || "")) {
      continue;
    }
    if (candidate.ageMinutes !== null && candidate.ageMinutes > MAX_AGE_MIN) {
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

    if (result === "success") {
      queuedCount += 1;
      console.log(
        `📥 SK handled ${queuedCount} tweet(s) this cycle so far (attempt ${attemptsUsed}/${MAX_CANDIDATES_PER_CYCLE})`,
      );
    }
  }

  if (queuedCount === 0) {
    console.log("ℹ️ No Sportskeeda tweet produced this cycle");
  }

  return queuedCount > 0;
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

    // ── Step 1: classify ────────────────────────────────────────────────────
    let articleType = "player_form";
    try {
      articleType = await classifyArticleGPT(fullText);
    } catch (error) {
      try {
        articleType = await classifyArticleGPT(fullText);
      } catch (error2) {
        console.log(
          "⚠️ Sportskeeda article classification failed twice, using default:",
          error2?.message || error2,
        );
      }
    }

    // ── Step 2: dedup + significance gate ───────────────────────────────────
    const existingContexts =
      STATE.dailyContext?.contexts?.map((c) => c.summary) || [];

    let decision = null;
    try {
      decision = await judgeNewsContextGPT({
        articleText: fullText,
        existingContexts,
      });
    } catch (error) {
      try {
        decision = await judgeNewsContextGPT({
          articleText: fullText,
          existingContexts,
        });
      } catch (error2) {}
    }

    if (!decision) {
      // Not marked seen — retried on the next cycle.
      console.log(
        "⚠️ SK judge failed twice, skipping for now:",
        parsed.headline,
      );
      return "retry-later";
    }

    if (decision?.isAlreadyCovered && decision?.confidence >= 0.8) {
      console.log("🔴 Sportskeeda skipped — already covered context");
      markSeen(STATE, selectedItem, cleanLink);
      await saveState(STATE, "Sportskeeda duplicate context skipped");
      return "skip";
    }

    const isExempt = SIGNIFICANCE_EXEMPT_TYPES.has(articleType);
    const score = decision?.significanceScore ?? 10;
    const vScore = decision?.viralityScore ?? "n/a";

    const isLowScore = !isExempt && score < 7;
    const sendViaWhatsApp = !POST_VIA_API || isLowScore;

    if (isLowScore && !POST_VIA_API) {
      markSeen(STATE, selectedItem, cleanLink);

      console.log(`🗂️ ARTICLE TYPE :: ${articleType}`);
      console.log(`📊 SIGNIFICANCE SCORE :: ${score} VIRALITY :: ${vScore}`);
      console.log(`📰 TWEET HEADLINE :: ${parsed.headline}`);
      console.log("🔴 SK ARTICLE SCORE IS TOO LOW");
      console.log("===========================================");

      await saveState(STATE, "Sportskeeda low significance skipped");
      return "skip";
    }

    if (isLowScore) {
      console.log(`📊 SIGNIFICANCE SCORE :: ${score} VIRALITY :: ${vScore}`);
      console.log(`📰 TWEET HEADLINE :: ${parsed.headline}`);
      console.log("📲 SK score < 7 — sending to WhatsApp, not X API");
    }

    if (!isExempt) {
      console.log(`✅ Significance: ${score}/10 — proceeding`);
    }

    // ── Step 3: tweet generation ────────────────────────────────────────────
    const longEligible = isLongTweetEligible(fullText);

    if (longEligible) {
      console.log("📏 SK article qualifies for long-tweet mode");
    }

    let tweetText = null;
    let player = "";
    let model = "claude";

    try {
      const claudeResult = await generateClaudeTweetWithType(
        fullText,
        articleType,
        SOURCE,
        longEligible,
      );
      tweetText = claudeResult?.tweetText || null;
      player = claudeResult?.player || "";
    } catch (error) {
      console.log(
        "⚠️ Claude Sportskeeda generation failed:",
        error?.message || error,
      );
    }

    if (!tweetText || tweetText.trim().length < 30) {
      try {
        const gptResult = await generateGPTTweetWithType(
          fullText,
          articleType,
          SOURCE,
          longEligible,
        );
        tweetText = gptResult?.tweetText || null;
        player = player || gptResult?.player || "";
        model = "GPT";
        console.log(
          tweetText
            ? "📝 GPT generated tweet (fallback)"
            : "📝 GPT generation returned no tweet",
        );
      } catch (error) {
        console.log(
          "⚠️ GPT Sportskeeda generation failed:",
          error?.message || error,
        );
      }
    }

    if (!tweetText) {
      console.log(
        "⏭️ Sportskeeda tweet generation failed — NOT marking seen, will retry next cycle",
      );
      await saveState(STATE, "Sportskeeda tweet generation failed");
      return "retry-later";
    }

    tweetText = applySourceSignature(tweetText, SOURCE);
    tweetText = tweetText.trim();
    if (!/[.!?]$/.test(tweetText)) tweetText += ".";

    // ── Step 4: deliver (WhatsApp draft or X API queue) ─────────────────────
    if (sendViaWhatsApp) {
      await sendTweetDraftToWhatsApp({
        source: SOURCE,
        headline: parsed.headline,
        tweetText,
        articleUrl: cleanLink,
      });
    } else {
      // Image work is only needed when the tweet is actually going to X.
      let generatedPath = null;

      if (player) {
        const cloudinaryImageUrl = await getPlayerImageUrl(player);
        if (cloudinaryImageUrl) {
          try {
            generatedPath = await downloadImageToTemp(cloudinaryImageUrl);
            console.log(`🖼️ Using Cloudinary photo for "${player}"`);
          } catch (error) {
            console.log(
              `⚠️ Failed to download Cloudinary photo for "${player}", posting text-only:`,
              error?.message || error,
            );
            generatedPath = null;
          }
        } else {
          console.log(
            `⏭️ No Cloudinary photo found for "${player}" — posting text-only`,
          );
        }
      } else {
        console.log("⏭️ No central player identified — posting text-only");
      }

      const imageUrl = parsed.imageUrl || null;
      const imageResult = await decideImageUsage(imageUrl, STATE.usedImages);

      enqueueTweet({
        id: `SK:${cleanLink}`,
        source: SOURCE,
        text: tweetText,
        imageUrl: generatedPath || null,
        seenKey: cleanLink,
        publishedAt: Date.now(),
        headline: parsed.headline,
        model,
        articleType,
        score,
      });

      console.log(`📥 Queued Sportskeeda tweet: ${parsed.headline}`);

      if (imageResult.useImage && imageUrl) {
        STATE.usedImages[imageUrl] = Date.now();
      }
    }

    markSeen(STATE, selectedItem, cleanLink);

    if (
      !isLowScore &&
      decision?.newContext &&
      !contextExists(STATE, decision.newContext)
    ) {
      STATE.dailyContext.contexts.push({
        summary: decision.newContext,
        source: SOURCE,
        link: cleanLink,
        createdAt: new Date().toISOString(),
      });
    }

    await saveState(STATE, "Sportskeeda tweet handled");
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
        Number.isFinite(timestamp) && Date.now() - timestamp <= CONTEXT_TTL_MS
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
