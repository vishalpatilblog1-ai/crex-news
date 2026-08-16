// x-news-cricket/xNewsPollingLoop.js
//
// Polling loop for X's native News Search API (GET /2/news/search).
// Structured to match skNewsPollingLoop.js so it slots into the existing
// STATE / tweetQueue / classify / generate machinery with minimal diff.
//
// EXPERIMENT STATUS: running in parallel with SK, not replacing it yet.
// Source signature "XN" lets daily view counts be tracked separately from
// CA (".") and YouTube ("!") — add that case to applySourceSignature in
// twitter/tweetQueue.js before flipping ENABLE_XNEWS_NEWS_POLLING + USE_WEB_TWEET on.
//
// NOTE ON PROVENANCE: story text is a Grok-generated summary of an X post
// cluster, not a bylined article. X's own API response carries a disclaimer
// that Grok can make mistakes. Do NOT relax SOURCE FIDELITY RULE / FRICTION
// SOURCE RULE guardrails for this source — if anything, compound factual
// claims (records, causal chains) from this source need MORE verification
// against cluster_posts_results, not less.

import {
  classifyArticle,
  generateGPTTweetWithType,
} from "../ai/generate-gpt-tweet.js";
import { judgeNewsContext } from "../indian-express/ai/judgeNewsContext.js";
import {
  applySourceSignature,
  enqueueTweet,
  // isQuietHoursBlocked,
} from "../twitter/tweetQueue.js";
import { saveState } from "../utils/stateStoreCloud.js";
import { fetchXNewsCricket } from "./fetchXNewsCricket.js";
import { isBlockedXNewsHeadline, isCricketStory } from "./xNewsFilters.js";

const USE_WEB_TWEET = process.env.USE_WEB_TWEET === "true";
const ENABLE_XNEWS_NEWS_POLLING =
  process.env.ENABLE_XNEWS_NEWS_POLLING === "true";
const SEEN_RETENTION_MS = 24 * 60 * 60 * 1000;
const IGNORE_SEEN = process.env.XNEWS_IGNORE_SEEN === "true";
const MAX_CANDIDATES_PER_CYCLE = Number(
  process.env.XNEWS_MAX_CANDIDATES_PER_CYCLE || 3,
);

export async function xNewsPollingLoop() {
  if (!ENABLE_XNEWS_NEWS_POLLING) {
    console.log(
      "🚫 ENABLE_XNEWS_NEWS_POLLING is not true — skipping X News polling",
    );
    return false;
  }

  if (!global.STATE) {
    console.log("⚠️ global.STATE is not available");
    return false;
  }

  // if (isQuietHoursBlocked("XN")) {
  //   console.log("🚫 X News polling paused during quiet hours (1-5 AM IST)");
  //   return false;
  // }

  const STATE = global.STATE;
  STATE.xnews ??= {};
  STATE.xnews.seen ??= {};
  STATE.dailyContext ??= { contexts: [] };
  STATE.dailyContext.contexts ??= [];
  STATE.xnews.failureStats ??= {
    rate_limit: 0,
    http_error: 0,
    network: 0,
    parse_error: 0,
    other: 0,
  };

  if (pruneSeen(STATE)) {
    await saveState(STATE, "X News state cleanup");
  }

  let candidates = [];

  try {
    const result = await fetchXNewsCricket();
    candidates = result.candidates;

    for (const failure of result.failures) {
      STATE.xnews.failureStats[failure.category] =
        (STATE.xnews.failureStats[failure.category] || 0) + 1;
      console.log(
        `⚠️ X News fetch failure [${failure.category}]:`,
        failure.message,
      );
    }
  } catch (error) {
    console.log("❌ X News fetch failed:", error?.message || error);
    return false;
  }

  if (!Array.isArray(candidates) || candidates.length === 0) {
    console.log("ℹ️ No X News stories found this cycle");
    return false;
  }

  console.log(`📰 X News candidates found: ${candidates.length}`);

  let attemptsUsed = 0;
  let queuedCount = 0;

  for (const candidate of candidates) {
    if (attemptsUsed >= MAX_CANDIDATES_PER_CYCLE) {
      console.log(
        `ℹ️ Reached ${MAX_CANDIDATES_PER_CYCLE} candidate attempts this cycle, stopping.`,
      );
      break;
    }

    if (!isCricketStory(candidate)) {
      console.log("⏭️ Not a cricket story, skipping:", candidate.headline);
      continue;
    }

    if (isBlockedXNewsHeadline(candidate.headline)) {
      console.log("⏭️ X News headline blocked:", candidate.headline);
      continue;
    }

    if (!IGNORE_SEEN && STATE.xnews.seen[candidate.newsId]) {
      console.log("⏭️ X News story already seen:", candidate.newsId);
      continue;
    }

    attemptsUsed += 1;

    // Don't stop after the first success — the tweet queue already paces
    // real posting (~156s gaps observed in prod), so every good candidate
    // this cycle gets queued rather than waiting for the next 15-min poll.
    const result = await attemptXNewsTweet(STATE, candidate);

    if (result === "success") queuedCount += 1;
  }

  if (queuedCount > 0) {
    console.log(`✅ Queued ${queuedCount} X News tweet(s) this cycle`);
    return true;
  }

  console.log("ℹ️ No X News tweet produced this cycle");
  return false;
}

async function attemptXNewsTweet(STATE, story) {
  try {
    // hook first, summary second — hook is the punchier framing, summary
    // carries the factual detail the generator needs for specifics.
    const fullText = `${story.headline}\n${story.hook}\n${story.summary}`;

    let articleType = "player_form";

    try {
      articleType = await classifyArticle(fullText);
    } catch (error) {
      console.log("⚠️ X News classification failed:", error?.message || error);
    }

    let decision = null;

    try {
      decision = await judgeNewsContext({
        articleText: fullText,
        existingContexts: STATE.dailyContext.contexts.map((c) => c.summary),
      });

      console.log(
        `📊 Scores — significance: ${decision?.significanceScore ?? "n/a"}, virality: ${decision?.viralityScore ?? "n/a"} — "${story.headline}"`,
      );

      if (decision?.isAlreadyCovered && decision?.confidence >= 0.8) {
        console.log("🔴 X News story already covered");
        markSeen(STATE, story);
        await saveState(STATE, "X News duplicate context");
        return "skip";
      }
    } catch (error) {
      console.log("⚠️ X News context check failed:", error?.message || error);
    }

    let tweetText = null;

    try {
      const claudeResult = await generateGPTTweetWithType(
        fullText,
        articleType,
      );
      tweetText = claudeResult?.tweetText || null;
    } catch (error) {
      console.log(
        "⚠️ Claude X News generation failed:",
        error?.message || error,
      );
    }

    if (!tweetText) {
      try {
        const gptResult = await generateGPTTweetWithType(fullText, articleType);
        tweetText = gptResult?.tweetText || null;
        console.log(
          tweetText
            ? "📝 GPT generated tweet"
            : "📝 GPT generation returned no tweet",
        );
      } catch (error) {
        console.log(
          "⚠️ GPT X News generation failed:",
          error?.message || error,
        );
      }
    }

    if (!tweetText) {
      console.log(
        "⏭️ X News tweet generation failed — NOT marking seen, will retry next cycle",
      );
      await saveState(STATE, "X News tweet generation failed");
      return "retry-later";
    }

    // "XN" source signature — add a case for it in applySourceSignature
    // (twitter/tweetQueue.js) — USE_WEB_TWEET is shared, gate this source via ENABLE_XNEWS_NEWS_POLLING instead.
    tweetText = applySourceSignature(tweetText, "XN");
    tweetText = tweetText.trim();
    if (!/[.!?]$/.test(tweetText)) tweetText += ".";

    if (!USE_WEB_TWEET) {
      console.log(
        "🧪 USE_WEB_TWEET is false — logging X News tweet instead of posting:",
        {
          headline: story.headline,
          newsId: story.newsId,
          tweetText,
          teams: story.teams,
          people: story.people,
        },
      );
      return "skip";
    }

    enqueueTweet({
      id: `XN:${story.newsId}`,
      source: "XN",
      text: tweetText,
      imageUrl: null,
      seenKey: story.newsId,
      publishedAt: Date.now(),
    });

    console.log(`📥 Queued X News tweet: ${story.headline}`);
    markSeen(STATE, story);

    if (decision?.newContext && !contextExists(STATE, decision.newContext)) {
      STATE.dailyContext.contexts.push({
        summary: decision.newContext,
        source: "XN",
        link: story.newsId,
        createdAt: new Date().toISOString(),
      });
    }

    await saveState(STATE, "X News tweet queued");
    console.log(`✅ X News processed: ${story.headline}`);
    return "success";
  } catch (error) {
    console.log("⚠️ X News processing failed:", error?.message || error);
    const category = error?.category || "other";
    STATE.xnews.failureStats[category] =
      (STATE.xnews.failureStats[category] || 0) + 1;
    return "retry-later";
  }
}

function markSeen(STATE, story) {
  if (story?.newsId) STATE.xnews.seen[story.newsId] = Date.now();
}

function pruneSeen(STATE) {
  const now = Date.now();
  let changed = false;
  for (const [key, timestamp] of Object.entries(STATE.xnews.seen)) {
    if (now - timestamp > SEEN_RETENTION_MS) {
      delete STATE.xnews.seen[key];
      changed = true;
    }
  }
  return changed;
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
