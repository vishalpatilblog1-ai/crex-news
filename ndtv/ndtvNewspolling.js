// ndtvnewsPollingLoop.js

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

import { fetchNDTVArticle } from "./fetchNDTVArticle.js";
import { isNDTVArticle, normalizeNDTVLink } from "./isNDTVArticle.js";
import { fetchNDTVCricketRSS } from "./ndtvRssFetcher.js";
import { parseNDTVArticle } from "./parseNDTVArticle.js";

const SOURCE = "NDTV";

const MAX_AGE_MIN = 120;

const SEEN_RETENTION_MS = 24 * 60 * 60 * 1000;
const PERFORMANCE_SCORE = Number(process.env.PERFORMANCE_SCORE) || 7;
const RETENTION_MS =
  (Number(process.env.CONTEXT_TTL_HOURS) > 0
    ? Number(process.env.CONTEXT_TTL_HOURS)
    : 6) *
  60 *
  60 *
  1000; // dailyContext prune window
const MAX_PER_POLL = 5; // cap how many tweets can queue / be sent in a single poll cycle

const POST_VIA_API = process.env.POST_VIA_API !== "false";

export async function ndtvNewspolling() {
  if (!global.STATE) {
    console.log("⚠️ global.STATE not ready. Skipping NDTV polling.");
    return false;
  }

  const STATE = global.STATE;

  STATE.ndtv ??= {};
  STATE.ndtv.seen ??= {};

  STATE.dailyContext ??= { contexts: [] };

  let stateDirty = false;
  stateDirty ||= pruneSeen(STATE, SEEN_RETENTION_MS);
  stateDirty ||= pruneDailyContext(STATE, RETENTION_MS);

  if (stateDirty) await saveState(STATE, "prune cleanup");

  let queuedCount = 0;

  try {
    const items = await fetchNDTVCricketRSS();
    if (!Array.isArray(items) || items.length === 0) {
      console.log("ℹ️ No NDTV RSS items");
      return false;
    }

    const sorted = [...items]
      .filter(isNDTVArticle)
      .sort((a, b) => getPubDate(b) - getPubDate(a));

    const candidates = [];
    for (const item of sorted) {
      const pubMs = getPubDate(item);

      if (pubMs) {
        const ageMin = (Date.now() - pubMs) / 60000;
        if (ageMin > MAX_AGE_MIN) {
          // console.log(
          //   `⏳ NDTV aged out (${Math.round(ageMin)}m): ${item.title}`,
          // );
          const cleanLinkAged = normalizeNDTVLink(item.link);
          if (cleanLinkAged) STATE.ndtv.seen[cleanLinkAged] = Date.now();
          continue;
        }
      }

      const cleanLink = normalizeNDTVLink(item.link);
      if (!cleanLink) continue;

      if (STATE.ndtv.seen[cleanLink]) continue;

      candidates.push(item);
    }

    if (candidates.length === 0) {
      // console.log("🟡 No eligible NDTV articles (age + dedupe)");
      await saveState(STATE, "no eligible candidates");
      return false;
    }

    // ---- Process every candidate (up to MAX_PER_POLL) ----
    for (const selected of candidates) {
      if (queuedCount >= MAX_PER_POLL) {
        console.log(
          `⏸️ NDTV hit MAX_PER_POLL (${MAX_PER_POLL}) — remaining stay unseen for next poll`,
        );
        break;
      }

      const cleanLink = normalizeNDTVLink(selected.link);
      const pubMs = getPubDate(selected);

      const markSeen = () => {
        STATE.ndtv.seen[cleanLink] = Date.now();
        STATE.ndtv.lastLink = cleanLink;
        STATE.ndtv.lastTitle = selected.title;
        STATE.ndtv.visibleDate = new Date(pubMs).toUTCString();
      };

      let parsed = null;

      try {
        const html = await fetchNDTVArticle(selected.link);
        parsed = parseNDTVArticle(html);
      } catch (err) {
        console.warn(
          "⚠️ NDTV article fetch failed, falling back to RSS description:",
          err?.message || err,
        );

        const rssDesc = selected.description?.trim();
        if (rssDesc && rssDesc.length > 30) {
          parsed = {
            headline: selected.title,
            body: rssDesc,
          };
        }
      }

      if (!parsed?.headline || !parsed?.body || parsed.body.length < 30) {
        console.warn("⚠️ No usable NDTV body, skipping article");
        STATE.ndtv.seen[cleanLink] = Date.now();
        continue;
      }

      const fullText = `${parsed.headline}\n${parsed.body}`;

      let articleType = "player_form";
      try {
        articleType = await classifyArticleGPT(fullText);
        console.log(`🏷️ Classified as: ${articleType}`);
      } catch (err) {
        try {
          articleType = await classifyArticleGPT(fullText);
        } catch (err2) {
          console.warn(
            "⚠️ NDTV classify failed twice, using default:",
            err2?.message,
          );
        }
      }

      const existingContexts =
        STATE.dailyContext?.contexts?.map((c) => c.summary) || [];

      let decision = null;
      try {
        decision = await judgeNewsContextGPT({
          articleText: fullText,
          existingContexts,
        });
      } catch (err) {
        try {
          decision = await judgeNewsContextGPT({
            articleText: fullText,
            existingContexts,
          });
        } catch (err2) {}
      }

      if (!decision) {
        // Not marked seen — retried on the next poll.
        console.log(
          "⚠️ NDTV judge failed twice, skipping for now:",
          selected.title,
        );
        continue;
      }

      if (decision?.isAlreadyCovered === true && decision?.confidence >= 0.8) {
        console.log(
          "🔁 NDTV context already covered — skipping:",
          selected.title,
        );
        markSeen();
        continue;
      }

      const isExempt = SIGNIFICANCE_EXEMPT_TYPES.has(articleType);
      const score = decision?.significanceScore ?? 10;
      const vScore = decision?.viralityScore ?? "n/a";

      const isLowScore = !isExempt && score < PERFORMANCE_SCORE;
      const sendViaWhatsApp = !POST_VIA_API || isLowScore;

      if (isLowScore && !POST_VIA_API) {
        markSeen();

        console.log(`🗂️ ARTICLE TYPE :: ${articleType}`);
        console.log(`📊 SIGNIFICANCE SCORE :: ${score} VIRALITY :: ${vScore}`);
        console.log(`📰 TWEET HEADLINE :: ${selected.title}`);
        console.log("🔴 NDTV ARTICLE SCORE IS TOO LOW");
        console.log("===========================================");

        await saveState(STATE, "low significance skipped");
        continue;
      }

      if (isLowScore) {
        console.log(`📊 SIGNIFICANCE SCORE :: ${score} VIRALITY :: ${vScore}`);
        console.log(`📰 TWEET HEADLINE :: ${selected.title}`);
        console.log(
          `📲 NDTV score < ${PERFORMANCE_SCORE} — sending to WhatsApp, not X API`,
        );
      }

      if (!isExempt) {
        console.log(`✅ Significance: ${score}/10 — proceeding`);
      }

      const longEligible = isLongTweetEligible(fullText);

      if (longEligible) {
        console.log("📏 NDTV article qualifies for long-tweet mode");
      }

      let tweetText = null;
      let generator = "claude";
      let model = "claude";

      try {
        const result = await generateClaudeTweetWithType(
          fullText,
          articleType,
          SOURCE,
          longEligible,
        );
        tweetText = result?.tweetText;
      } catch (err) {
        console.warn("⚠️ Claude failed:", err?.message || err);
      }

      if (!tweetText || tweetText.trim().length < 30) {
        generator = "gpt";
        try {
          const result = await generateGPTTweetWithType(
            fullText,
            articleType,
            SOURCE,
            longEligible,
          );
          tweetText = result?.tweetText;
          model = "GPT";
        } catch (err) {
          console.warn(
            "⚠️ NDTV AI failed, skipping tweet:",
            err?.message || err,
          );
          continue;
        }
      }

      if (!tweetText || tweetText.trim().length < 30) {
        console.warn("⚠️ NDTV tweet generation failed / too short");
        STATE.ndtv.seen[cleanLink] = Date.now();
        continue;
      }

      tweetText = applySourceSignature(tweetText, SOURCE);
      tweetText = tweetText.trim().replace(/\.?$/, ".");

      if (sendViaWhatsApp) {
        await sendTweetDraftToWhatsApp({
          source: SOURCE,
          headline: selected.title,
          tweetText,
          articleUrl: cleanLink,
          articleType,
          score,
          virality: vScore,
          articleText: fullText,
          generator,
        });
      } else {
        enqueueTweet({
          id: cleanLink,
          source: SOURCE,
          text: tweetText,
          imageUrl: null,
          seenKey: cleanLink,
          publishedAt: pubMs || Date.now(),
          headline: selected.title,
          model,
          articleType,
          score,
        });

        console.log(`📥 TWEET HEADLINE: ${selected.title}`);
      }

      markSeen();

      queuedCount++;

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
    }

    await saveState(STATE, "NDTV poll cycle complete");
    return queuedCount > 0;
  } catch (err) {
    console.error("❌ ERROR in NDTV polling:", err);
    return false;
  }
}

function getPubDate(item) {
  return item?.pubDate ? new Date(item.pubDate).getTime() : 0;
}

function pruneSeen(STATE, retentionMs) {
  try {
    const now = Date.now();
    let pruned = 0;

    for (const [link, ts] of Object.entries(STATE.ndtv?.seen || {})) {
      if (now - ts > retentionMs) {
        delete STATE.ndtv.seen[link];
        pruned++;
      }
    }

    if (pruned > 0) {
      return true;
    }
  } catch (err) {
    console.warn("⚠️ NDTV seen prune failed:", err?.message || err);
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
      return true;
    }
  } catch (err) {
    console.warn("⚠️ dailyContext prune failed:", err?.message || err);
  }
  return false;
}

function contextExists(STATE, summary) {
  if (!STATE.dailyContext?.contexts?.length) return false;
  const norm = normalizeSummary(summary);
  return STATE.dailyContext.contexts.some(
    (c) => normalizeSummary(c.summary) === norm,
  );
}

function normalizeSummary(text = "") {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
