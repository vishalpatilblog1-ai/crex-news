// ieNewsPollingLoop.js

import { generateGeminiTweet } from "../ai/generate-gemini-tweet.js";
import {
  classifyArticle,
  generateClaudeTweet,
  SIGNIFICANCE_EXEMPT_TYPES,
} from "../ai/generateClaudeTweet.js";
import { generateCardImage } from "../canvas/imageRenderer.js";
import { enqueueTweet } from "../twitter/tweetQueue.js";
import { CREX_BASE_IMAGE_TEMPLATE_NEW } from "../utils/config.js";
import { saveState } from "../utils/stateStoreCloud.js";

import { judgeNewsContext } from "./ai/judgeNewsContext.js";
import { fetchIEArticle } from "./fetchIEArticle.js";
import { isIEArticle, normalizeIELink } from "./ieFilters.js";
import { fetchIECricketRSS } from "./ieRssFetcher.js";
import { parseIEArticle } from "./parseIEArticle.js";

const MAX_AGE_MIN = 60;
const SEEN_RETENTION_MS = 6 * 60 * 60 * 1000; // 6 hours
const CONSOLE_ONLY = process.env.CONSOLE_ONLY === "true";

export async function ieNewsPollingLoop() {
  if (!global.STATE) {
    console.log("⚠️ global.STATE not ready. Skipping IE polling.");
    return;
  }

  const STATE = global.STATE;

  STATE.ie ??= {};
  STATE.ie.seen ??= {};

  const today = getTodayUTC();
  if (!STATE.dailyContext || STATE.dailyContext.date !== today) {
    STATE.dailyContext = { date: today, contexts: [] };
  }

  try {
    // ── Prune stale seen entries ──────────────────────────────────────────────
    const now = Date.now();
    let pruned = 0;

    for (const [link, ts] of Object.entries(STATE.ie.seen)) {
      if (now - ts > SEEN_RETENTION_MS) {
        delete STATE.ie.seen[link];
        pruned++;
      }
    }

    if (pruned) console.log(`🧹 Pruned ${pruned} old IE seen entries`);

    // ── Fetch + filter RSS ────────────────────────────────────────────────────
    const items = await fetchIECricketRSS();
    if (!Array.isArray(items) || items.length === 0) {
      console.log("ℹ️ No IE RSS items");
      return;
    }

    const sorted = items
      .filter(isIEArticle)
      .sort((a, b) => getPubDate(b) - getPubDate(a));

    let selected = null;

    for (const item of sorted) {
      const pubMs = getPubDate(item);
      if (!pubMs) continue;

      const ageMin = (Date.now() - pubMs) / 60000;
      if (ageMin > MAX_AGE_MIN) continue;

      const cleanLink = normalizeIELink(item.link);
      if (STATE.ie.seen[cleanLink]) continue;

      selected = item;
      break;
    }

    if (!selected) {
      console.log("🟡 No eligible IE articles (age + dedupe)");
      return;
    }

    console.log(
      "🆕 IE news detected:",
      selected.title,
      "| pubDate:",
      selected.pubDate,
    );

    // ── Fetch article body ────────────────────────────────────────────────────
    const html = await fetchIEArticle(selected.link);
    const parsed = parseIEArticle(html);

    if (!parsed?.body || parsed.body.length < 80) {
      console.warn("⚠️ IE article body missing / too short");
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
        console.log("🔁 IE context already covered — skipping");
        const cleanLink = normalizeIELink(selected.link);
        STATE.ie.seen[cleanLink] = Date.now();
        STATE.ie.lastLink = cleanLink;
        STATE.ie.lastTitle = selected.title;
        STATE.ie.visibleDate = new Date(getPubDate(selected)).toUTCString();
        await saveState(STATE);
        return;
      }

      const isExempt = SIGNIFICANCE_EXEMPT_TYPES.has(articleType);
      const score = contextDecision?.significanceScore ?? 10;

      if (!isExempt && score < 7) {
        console.log(
          `⬇️ Low significance (${score}/10) — skipping: ${selected.title}`,
        );
        const cleanLink = normalizeIELink(selected.link);
        STATE.ie.seen[cleanLink] = Date.now();
        STATE.ie.lastLink = cleanLink;
        STATE.ie.lastTitle = selected.title;
        STATE.ie.visibleDate = new Date(getPubDate(selected)).toUTCString();
        await saveState(STATE);
        return;
      }

      if (isExempt) {
        console.log(
          `🌟 Exempt type (${articleType}) — bypassing significance gate (score: ${score}/10)`,
        );
      } else {
        console.log(`✅ Significance: ${score}/10 — proceeding`);
      }
    } catch (err) {
      console.warn(
        "⚠️ IE context judge failed, proceeding without dedup:",
        err.message,
      );
    }

    // ── Step 3: Tweet generation ──────────────────────────────────────────────
    let tweetText = null;
    let generatedPath = null;
    try {
      // const result = await generateClaudeTweetWithType(fullText, articleType);
      const { tweetText: claudeTweet, card } =
        await generateClaudeTweet(fullText);
      tweetText = claudeTweet;
      console.log("claudeTweet IE:::", tweetText, "card::", card);

      if (card) {
        try {
          generatedPath = await generateCardImage(
            CREX_BASE_IMAGE_TEMPLATE_NEW,
            card,
          );
        } catch (err) {
          console.error("❌ Image generation failed:", err);
        }
      } else {
        console.log("📝 Text-only tweet (no card)");
      }
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
      console.warn("⚠️ IE AI failed, skipping tweet");
      return;
    }

    // temporary commented
    // const imageUrl = getIEImageUrl(selected);

    // if (!imageUrl) {
    //   console.log("🚫 Skipping IE article — no image found");
    //   const cleanUrl = normalizeIELink(selected.link);
    //   STATE.ie.seen[cleanUrl] = Date.now();
    //   STATE.ie.lastLink = cleanUrl;
    //   STATE.ie.lastTitle = selected.title;
    //   STATE.ie.visibleDate = new Date(getPubDate(selected)).toUTCString();
    //   await saveState(STATE);
    //   return;
    // }

    // const decision = await decideIEImageUsage(imageUrl);
    // console.log("IE imageUrl::", imageUrl);

    // if (!decision.useImage) {
    //   console.log(
    //     "🚫 Skipping IE article due to risky image:",
    //     decision.reason
    //   );
    //   const cleanUrl = normalizeIELink(selected.link);
    //   STATE.ie.seen[cleanUrl] = Date.now();
    //   STATE.ie.lastLink = cleanUrl;
    //   STATE.ie.lastTitle = selected.title;
    //   STATE.ie.visibleDate = new Date(getPubDate(selected)).toUTCString();
    //   await saveState(STATE);
    //   return;
    // }

    const cleanUrl = normalizeIELink(selected.link);
    const tweetId = `IE:${cleanUrl}`;

    if (CONSOLE_ONLY) {
      console.log("tweetText::", tweetText);
      console.log("🧪 CONSOLE_ONLY mode. Not enqueueing.");
      return;
    }

    enqueueTweet({
      id: tweetId,
      source: "IE",
      text: tweetText,
      imageUrl: generatedPath || null,
      // imageUrl,
      seenKey: cleanUrl,
    });

    console.log(`📥 Queued IE tweet: ${selected.title}`);

    STATE.ie.seen[cleanUrl] = Date.now();
    STATE.ie.lastLink = cleanUrl;
    STATE.ie.lastTitle = selected.title;
    STATE.ie.visibleDate = new Date(getPubDate(selected)).toUTCString();

    if (contextDecision?.newContext) {
      STATE.dailyContext.contexts.push({
        summary: contextDecision.newContext,
        source: "IE",
        link: cleanUrl,
        createdAt: new Date().toISOString(),
      });
    }

    await saveState(STATE);
    console.log("🟢 IE state + dailyContext saved");
  } catch (err) {
    console.error("❌ ERROR in IE polling:", err);
  }
}

function getPubDate(item) {
  return item?.pubDate ? new Date(item.pubDate).getTime() : 0;
}

function getTodayUTC() {
  return new Date().toISOString().slice(0, 10);
}
