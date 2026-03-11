// ieNewsPollingLoop.js

import { generateGeminiTweet } from "../ai/generate-gemini-tweet.js";
import { generateGPTTweet } from "../ai/generate-gpt-tweet.js";
import { generateClaudeTweet } from "../ai/generateClaudeTweet.js";
import { enqueueTweet } from "../twitter/tweetQueue.js";
import { saveState } from "../utils/stateStoreCloud.js";

import { generateIEFallbackTweet } from "./ai/generateIEFallbackTweet.js";
import { judgeNewsContext } from "./ai/judgeNewsContext.js";

import { fetchIEArticle } from "./fetchIEArticle.js";
import { getIEImageUrl } from "./getIEImageUrl.js";
import {
  decideIEImageUsage,
  isIEArticle,
  normalizeIELink,
} from "./ieFilters.js";
import { fetchIECricketRSS } from "./ieRssFetcher.js";
import { parseIEArticle } from "./parseIEArticle.js";

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
    STATE.dailyContext = {
      date: today,
      contexts: [],
    };
  }

  const MAX_AGE_MIN = 60;
  const SEEN_RETENTION_HOURS = 6;
  const CONSOLE_ONLY = process.env.CONSOLE_ONLY === "true";

  const SEEN_RETENTION_MS = SEEN_RETENTION_HOURS * 60 * 60 * 1000;

  try {
    const now = Date.now();
    let pruned = 0;

    for (const [link, ts] of Object.entries(STATE.ie.seen)) {
      if (now - ts > SEEN_RETENTION_MS) {
        delete STATE.ie.seen[link];
        pruned++;
      }
    }

    if (pruned) {
      console.log(`🧹 Pruned ${pruned} old IE seen entries`);
    }

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
      "| consoleOnly:",
      CONSOLE_ONLY
    );

    const html = await fetchIEArticle(selected.link);
    const parsed = parseIEArticle(html);

    if (!parsed?.body || parsed.body.length < 80) {
      console.warn("⚠️ IE article body missing / too short");
      return;
    }

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
    } catch (err) {
      console.warn(
        "⚠️ IE context judge failed, proceeding without dedup:",
        err.message
      );
    }

    let tweetBody;

    try {
      try {
        tweetBody = await generateClaudeTweet(
          `${parsed.headline}\n${parsed.body}`
        );
      } catch (err) {
        console.warn("⚠️ Gemini failed:", err?.message || err);
      }

      if (!tweetBody) {
        try {
          tweetBody = await generateGeminiTweet(
            `${parsed.headline}\n${parsed.body}`
          );
        } catch (err) {
          console.warn("⚠️ Claude failed:", err?.message || err);
        }
      }

      if (!tweetBody || tweetBody.trim().length < 30) {
        throw new Error("AI output invalid");
      }
    } catch (err) {
      console.warn("⚠️ IE AI failed, skipping tweet:", err.message);
      return;
    }

    let tweetText = tweetBody;

    let imageUrl = getIEImageUrl(selected);

    if (!imageUrl) {
      console.log("🚫 Skipping IE article — no image found");
      const cleanUrl = normalizeIELink(selected.link);
      STATE.ie.seen[cleanUrl] = Date.now();
      STATE.ie.lastLink = cleanUrl;
      STATE.ie.lastTitle = selected.title;
      STATE.ie.visibleDate = new Date(getPubDate(selected)).toUTCString();

      await saveState(STATE);
      return;
    }

    const decision = await decideIEImageUsage(imageUrl);

    console.log("IE imageUrl::", imageUrl);

    if (!decision.useImage) {
      console.log(
        "🚫 Skipping IE article due to risky image:",
        decision.reason
      );

      const cleanUrl = normalizeIELink(selected.link);
      STATE.ie.seen[cleanUrl] = Date.now();
      STATE.ie.lastLink = cleanUrl;
      STATE.ie.lastTitle = selected.title;
      STATE.ie.visibleDate = new Date(getPubDate(selected)).toUTCString();

      await saveState(STATE);
      return;
    }

    console.log("imageUrl IE After::", imageUrl);

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
      imageUrl,
      seenKey: cleanUrl,
      // articleBody: parsed.body,
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
