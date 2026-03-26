// ndtvnewsPollingLoop.js

import { generateGeminiTweet } from "../ai/generate-gemini-tweet.js";
import {
  classifyArticle,
  generateClaudeTweetWithType,
  SIGNIFICANCE_EXEMPT_TYPES,
} from "../ai/generateClaudeTweet.js";
import {
  renderNewsCardImage,
  saveGeneratedImage,
} from "../canvas/renderNewsCardImage.js";
import { judgeNewsContext } from "../indian-express/ai/judgeNewsContext.js";
import { enqueueTweet } from "../twitter/tweetQueue.js";
import { CREX_BASE_IMAGE_TEMPLATE } from "../utils/config.js";
import { saveState } from "../utils/stateStoreCloud.js";
import { fetchNDTVArticle } from "./fetchNDTVArticle.js";
import { getNDTVImageUrl } from "./getNDTVImageUrl.js";
import { isNDTVArticle, normalizeNDTVLink } from "./isNDTVArticle.js";
import { fetchNDTVCricketRSS } from "./ndtvRssFetcher.js";
import { parseNDTVArticle } from "./parseNDTVArticle.js";

const MAX_AGE_MIN = 60;
const SEEN_RETENTION_MS = 6 * 60 * 60 * 1000; // 6 hours
const CONSOLE_ONLY = process.env.CONSOLE_ONLY === "true";

export async function ndtvNewspolling____() {
  if (!global.STATE) {
    console.log("⚠️ global.STATE not ready. Skipping NDTV polling.");
    return;
  }

  const STATE = global.STATE;

  STATE.ndtv ??= {};
  STATE.ndtv.seen ??= {};

  const today = getTodayUTC();
  if (!STATE.dailyContext || STATE.dailyContext.date !== today) {
    STATE.dailyContext = {
      date: today,
      contexts: [],
    };
  }

  try {
    // ── Prune stale seen entries ──────────────────────────────────────────────
    const now = Date.now();
    let pruned = 0;

    for (const [link, ts] of Object.entries(STATE.ndtv.seen)) {
      if (now - ts > SEEN_RETENTION_MS) {
        delete STATE.ndtv.seen[link];
        pruned++;
      }
    }

    if (pruned) {
      console.log(`🧹 Pruned ${pruned} old NDTV seen entries`);
    }

    // ── Fetch + filter RSS ────────────────────────────────────────────────────
    const items = await fetchNDTVCricketRSS();
    if (!Array.isArray(items) || items.length === 0) {
      console.log("ℹ️ No NDTV RSS items");
      return;
    }

    const sorted = items
      .filter(isNDTVArticle)
      .sort((a, b) => getPubDate(b) - getPubDate(a));

    let selected = null;

    for (const item of sorted) {
      const pubMs = getPubDate(item);
      if (!pubMs) continue;

      const ageMin = (Date.now() - pubMs) / 60000;
      if (ageMin > MAX_AGE_MIN) continue;

      const cleanLink = normalizeNDTVLink(item.link);
      if (STATE.ndtv.seen[cleanLink]) continue;

      selected = item;
      break;
    }

    if (!selected) {
      console.log("🟡 No eligible NDTV articles (age + dedupe)");
      return;
    }

    // ── Fetch article body ────────────────────────────────────────────────────
    let parsed = null;

    try {
      const html = await fetchNDTVArticle(selected.link);
      parsed = parseNDTVArticle(html);
    } catch (err) {
      console.warn(
        "⚠️ NDTV article fetch failed, falling back to RSS description:",
        err.message
      );

      const rssDesc = selected.description?.trim();
      if (rssDesc && rssDesc.length > 30) {
        parsed = {
          headline: selected.title,
          body: rssDesc,
        };
      }
    }

    if (!parsed?.body || parsed.body.length < 30) {
      console.warn("⚠️ No usable NDTV body, skipping article");
      const cleanLink = normalizeNDTVLink(selected.link);
      STATE.ndtv.seen[cleanLink] = Date.now();
      await saveState(STATE);
      return;
    }

    const fullText = `${parsed.headline}\n${parsed.body}`;

    // ── Step 1: Classify article type first ──────────────────────────────────
    let articleType = "player_form";
    try {
      articleType = await classifyArticle(fullText);
      console.log(`🏷️ Classified as: ${articleType}`);
    } catch (err) {
      console.warn("⚠️ classifyArticle failed, using default:", err?.message);
    }

    // ── Step 2: Deduplication + significance gate ─────────────────────────────
    let contextDecision = null;
    try {
      contextDecision = await judgeNewsContext({
        articleText: parsed.body,
        existingContexts: STATE.dailyContext.contexts.map((c) => c.summary),
      });

      if (
        contextDecision?.isAlreadyCovered === true &&
        contextDecision?.confidence >= 0.8
      ) {
        console.log("🔁 NDTV context already covered — skipping");
        const cleanLink = normalizeNDTVLink(selected.link);
        STATE.ndtv.seen[cleanLink] = Date.now();
        STATE.ndtv.lastLink = cleanLink;
        STATE.ndtv.lastTitle = selected.title;
        STATE.ndtv.visibleDate = new Date(getPubDate(selected)).toUTCString();
        await saveState(STATE);
        return;
      }

      const isExempt = SIGNIFICANCE_EXEMPT_TYPES.has(articleType);
      const score = contextDecision?.significanceScore ?? 10;

      // temporary commented but very important and needed for future use
      if (!isExempt && score < 7) {
        // if (!isExempt) {
        console.log(
          `⬇️ Low significance (${score}/10) — skipping: ${selected.title}`
        );
        const cleanLink = normalizeNDTVLink(selected.link);
        STATE.ndtv.seen[cleanLink] = Date.now();
        STATE.ndtv.lastLink = cleanLink;
        STATE.ndtv.lastTitle = selected.title;
        STATE.ndtv.visibleDate = new Date(getPubDate(selected)).toUTCString();
        await saveState(STATE);
        return;
      }

      if (isExempt) {
        console.log(
          `🌟 Exempt type (${articleType}) — bypassing significance gate (score: ${score}/10)`
        );
      } else {
        console.log(`✅ Significance: ${score}/10 — proceeding`);
      }
    } catch (err) {
      console.warn(
        "⚠️ NDTV context judge failed, proceeding without dedup:",
        err.message
      );
    }

    // let tweetText = null;
    // try {
    //   const result = await generateClaudeTweetWithType(fullText, articleType);
    //   tweetText = result.tweetText;
    //   console.log("Prompt generated by claude ....");
    // } catch (err) {
    //   console.warn("⚠️ Claude failed:", err?.message || err);
    // }

    let tweetText = null;
    let generatedPath = null;

    try {
      const { tweetText: claudeTweet, card } = await generateClaudeTweet(
        `${parsed.headline}\n${parsed.body}`
      );

      tweetText = claudeTweet;

      // ✅ FIX: correct logging (you were printing claudeTweet twice)
      console.log("claudeTweet NDTV:::", tweetText, "card::", card);

      // ✅ Only generate image if card exists
      if (card) {
        try {
          const imageBuffer = await renderNewsCardImage(
            CREX_BASE_IMAGE_TEMPLATE,
            card
          );

          generatedPath = saveGeneratedImage(imageBuffer);

          console.log("generatedPath:::", generatedPath);
        } catch (err) {
          console.error("❌ Image generation failed:", err);
          // ⚠️ Do NOT return → fallback to text-only
        }
      } else {
        console.log("📝 Text-only tweet (no card)");
      }

      console.log("Prompt generated by Claude ....");
    } catch (err) {
      console.warn("⚠️ Claude failed:", err?.message || err);
    }

    if (!tweetText || tweetText.trim().length < 30) {
      try {
        tweetText = await generateGeminiTweet(fullText);
        console.log("Prompt generated by Gemini ....");
      } catch (err) {
        console.warn("⚠️ Gemini failed:", err?.message || err);
      }
    }

    if (!tweetText || tweetText.trim().length < 30) {
      console.warn("⚠️ NDTV AI failed, skipping tweet");
      return;
    }

    // ── Image check ───────────────────────────────────────────────────────────
    const imageUrl = getNDTVImageUrl(selected);
    // const imageUrl = generatedPath;

    if (!imageUrl) {
      console.log("🚫 Skipping NDTV article — no image found");
      const cleanUrl = normalizeNDTVLink(selected.link);
      STATE.ndtv.seen[cleanUrl] = Date.now();
      STATE.ndtv.lastLink = cleanUrl;
      STATE.ndtv.lastTitle = selected.title;
      STATE.ndtv.visibleDate = new Date(getPubDate(selected)).toUTCString();
      await saveState(STATE);
      return;
    }

    // ── Enqueue ───────────────────────────────────────────────────────────────
    const cleanUrl = normalizeNDTVLink(selected.link);
    const tweetId = `NDTV:${cleanUrl}`;

    if (CONSOLE_ONLY) {
      console.log("tweetText::", tweetText);
      console.log("🧪 CONSOLE_ONLY mode. Not enqueueing.");
      return;
    }

    enqueueTweet({
      id: tweetId,
      source: "NDTV",
      text: tweetText,
      imageUrl: generatedPath || null,
      // imageUrl,
      seenKey: cleanUrl,
    });

    console.log(`📥 Queued NDTV tweet: ${selected.title}`);

    STATE.ndtv.seen[cleanUrl] = Date.now();
    STATE.ndtv.lastLink = cleanUrl;
    STATE.ndtv.lastTitle = selected.title;
    STATE.ndtv.visibleDate = new Date(getPubDate(selected)).toUTCString();

    if (contextDecision?.newContext) {
      STATE.dailyContext.contexts.push({
        summary: contextDecision.newContext,
        source: "NDTV",
        link: cleanUrl,
        createdAt: new Date().toISOString(),
      });
    }

    await saveState(STATE);
    console.log("🟢 NDTV state + dailyContext saved");
  } catch (err) {
    console.error("❌ ERROR in NDTV polling:", err);
  }
}

function getPubDate(item) {
  return item?.pubDate ? new Date(item.pubDate).getTime() : 0;
}

function getTodayUTC() {
  return new Date().toISOString().slice(0, 10);
}
