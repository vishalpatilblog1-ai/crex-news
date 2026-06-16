// footballNewsPollingLoop.js

import { generateGeminiTweet } from "../ai/generate-gemini-tweet.js";
import {
  classifyFootballArticle,
  generateFootbalGPTTweetWithType,
  SIGNIFICANCE_EXEMPT_TYPES,
} from "../ai/generate-gpt-tweet-football.js";

import { generateCardImage } from "../canvas/imageRenderer.js";
import { judgeFootballNewsContext } from "../indian-express/ai/judgeFootballNewsContext.js";

import { enqueueTweet } from "../twitter/tweetQueue.js";
import { CREX_BASE_IMAGE_TEMPLATE } from "../utils/config.js";
import { saveState } from "../utils/stateStoreCloud.js";
import { fetchNDTVArticle } from "./fetchNDTVArticle.js";
// import { fetchFootballArticle } from "./fetchFootballArticle.js";
import {
  isNDTVFootballArticle,
  normalizeNDTVFootballLink,
} from "./isNDTVArticle.js";
import { fetchNDTVFootballRSS } from "./ndtvRssFetcher.js";
import { parseNDTVArticle } from "./parseNDTVArticle.js";

const MAX_AGE_MIN = 60;
const SEEN_RETENTION_MS = 6 * 60 * 60 * 1000; // 6 hours
const CONSOLE_ONLY = process.env.CONSOLE_ONLY === "true";

export async function ndtvFootballNewspolling() {
  if (!global.STATE) {
    console.log("⚠️ global.STATE not ready. Skipping football polling.");
    return;
  }

  const STATE = global.STATE;

  STATE.football ??= {};
  STATE.football.seen ??= {};

  const today = getTodayUTC();
  if (
    !STATE.footballDailyContext ||
    STATE.footballDailyContext.date !== today
  ) {
    STATE.footballDailyContext = {
      date: today,
      contexts: [],
    };
  }

  try {
    // ── Prune stale seen entries ──────────────────────────────────────────────
    const now = Date.now();
    let pruned = 0;

    for (const [link, ts] of Object.entries(STATE.football.seen)) {
      if (now - ts > SEEN_RETENTION_MS) {
        delete STATE.football.seen[link];
        pruned++;
      }
    }

    if (pruned) {
      console.log(`🧹 Pruned ${pruned} old football seen entries`);
    }

    // ── Fetch + filter RSS ────────────────────────────────────────────────────
    const items = await fetchNDTVFootballRSS();
    if (!Array.isArray(items) || items.length === 0) {
      console.log("ℹ️ No football RSS items");
      return;
    }

    const sorted = items
      .filter(isNDTVFootballArticle)
      .sort((a, b) => getPubDate(b) - getPubDate(a));

    let selected = null;

    for (const item of sorted) {
      const pubMs = getPubDate(item);
      if (!pubMs) continue;

      const ageMin = (Date.now() - pubMs) / 60000;
      if (ageMin > MAX_AGE_MIN) continue;

      const cleanLink = normalizeNDTVFootballLink(item.link);
      if (STATE.football.seen[cleanLink]) continue;

      selected = item;
      break;
    }

    if (!selected) {
      console.log("🟡 No eligible football articles (age + dedupe)");
      return;
    }

    // ── Fetch article body ────────────────────────────────────────────────────
    let parsed = null;

    try {
      const html = await fetchNDTVArticle(selected.link);
      parsed = parseNDTVArticle(html);
    } catch (err) {
      console.warn(
        "⚠️ Football article fetch failed, falling back to RSS description:",
        err.message,
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
      console.warn("⚠️ No usable football body, skipping article");
      const cleanLink = normalizeNDTVFootballLink(selected.link);
      STATE.football.seen[cleanLink] = Date.now();
      await saveState(STATE);
      return;
    }

    const fullText = `${parsed.headline}\n${parsed.body}`;

    // ── Classify ──────────────────────────────────────────────────────────────
    let articleType = "player_form";
    try {
      articleType = await classifyFootballArticle(fullText);
      console.log(`🏷️ Classified as: ${articleType}`);
    } catch (err) {
      console.warn("⚠️ classifyArticle failed, using default:", err?.message);
    }

    // ── Context dedup + significance gate ────────────────────────────────────
    let contextDecision = null;
    try {
      contextDecision = await judgeFootballNewsContext({
        articleText: parsed.body,
        existingContexts: STATE.footballDailyContext.contexts.map(
          (c) => c.summary,
        ),
      });

      if (
        contextDecision?.isAlreadyCovered === true &&
        contextDecision?.confidence >= 0.8
      ) {
        console.log("🔁 Football context already covered — skipping");
        const cleanLink = normalizeNDTVFootballLink(selected.link);
        STATE.football.seen[cleanLink] = Date.now();
        STATE.football.lastLink = cleanLink;
        STATE.football.lastTitle = selected.title;
        STATE.football.visibleDate = new Date(
          getPubDate(selected),
        ).toUTCString();
        await saveState(STATE);
        return;
      }

      const isExempt = SIGNIFICANCE_EXEMPT_TYPES.has(articleType);
      const score = contextDecision?.significanceScore ?? 10;

      if (!isExempt && score < 7) {
        console.log(
          `⬇️ Low significance (${score}/10) — skipping: ${selected.title}`,
        );
        const cleanLink = normalizeNDTVFootballLink(selected.link);
        STATE.football.seen[cleanLink] = Date.now();
        STATE.football.lastLink = cleanLink;
        STATE.football.lastTitle = selected.title;
        STATE.football.visibleDate = new Date(
          getPubDate(selected),
        ).toUTCString();
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
        "⚠️ Football context judge failed, proceeding without dedup:",
        err.message,
      );
    }

    // ── Tweet generation — Claude primary, Gemini fallback ───────────────────
    let tweetText = null;
    let generatedPath = null;

    try {
      // const { tweetText: tweetToPost, card } =
      //   await generateClaudeTweetWithType(
      //     `${parsed.headline}\n${parsed.body}`,
      //     articleType,
      //   );
      const { tweetText: tweetToPost, card } =
        await generateFootbalGPTTweetWithType(
          `${parsed.headline}\n${parsed.body}`,
          articleType,
        );

      tweetText = tweetToPost;

      console.log("tweetToPost football:::", tweetToPost, "card::", card);

      if (card) {
        try {
          generatedPath = await generateCardImage(
            CREX_BASE_IMAGE_TEMPLATE,
            card,
          );
        } catch (err) {
          console.error("❌ Image generation failed:", err);
        }
      } else {
        console.log("📝 Text-only tweet (no card)");
      }

      console.log("Prompt generated by Claude ....");
    } catch (err) {
      console.warn("⚠️ Claude failed:", err?.message || err);
    }

    // ── Gemini fallback ───────────────────────────────────────────────────────
    if (!tweetText || tweetText.trim().length < 30) {
      try {
        const { tweetText: geminiTweet, card } =
          await generateGeminiTweet(fullText);

        tweetText = geminiTweet;

        console.log("Gemini fallback tweet info:::");
        console.log("Gemini tweetText::", tweetText);
        console.log("Gemini card::", card);

        if (card) {
          try {
            generatedPath = await generateCardImage(
              CREX_BASE_IMAGE_TEMPLATE,
              card,
            );
            console.log("Gemini generatedPath:::", generatedPath);
          } catch (err) {
            console.error("❌ Image generation failed:", err);
          }
        } else {
          console.log("📝 Text-only tweet (no card)");
        }

        console.log("Prompt generated by Gemini ....");
      } catch (err) {
        console.warn("⚠️ Gemini failed:", err?.message || err);
      }
    }

    if (!tweetText || tweetText.trim().length < 30) {
      console.warn("⚠️ Football AI failed, skipping tweet");
      return;
    }

    // tweetText = `${tweetText}\n\n#FIFAWorldCup2026`;

    // ── Enqueue ───────────────────────────────────────────────────────────────
    const cleanUrl = normalizeNDTVFootballLink(selected.link);
    const tweetId = `FOOTBALL:${cleanUrl}`;

    if (CONSOLE_ONLY) {
      console.log("tweetText::", tweetText);
      console.log("🧪 CONSOLE_ONLY mode. Not enqueueing.");
      return;
    }

    enqueueTweet({
      id: tweetId,
      source: "FOOTBALL",
      text: tweetText,
      imageUrl: generatedPath || null,
      seenKey: cleanUrl,
    });

    console.log(`📥 Queued football tweet: ${selected.title}`);

    STATE.football.seen[cleanUrl] = Date.now();
    STATE.football.lastLink = cleanUrl;
    STATE.football.lastTitle = selected.title;
    STATE.football.visibleDate = new Date(getPubDate(selected)).toUTCString();

    if (contextDecision?.newContext) {
      STATE.footballDailyContext.contexts.push({
        summary: contextDecision.newContext,
        source: "FOOTBALL",
        link: cleanUrl,
        createdAt: new Date().toISOString(),
      });
    }

    await saveState(STATE);
    console.log("🟢 Football state + dailyContext saved");
  } catch (err) {
    console.error("❌ ERROR in football polling:", err);
  }
}

function getPubDate(item) {
  return item?.pubDate ? new Date(item.pubDate).getTime() : 0;
}

function getTodayUTC() {
  return new Date().toISOString().slice(0, 10);
}
