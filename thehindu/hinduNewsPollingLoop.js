import { tweetWithNativeImage } from "../twitter/tweetWithImage.js";
import { postTweet_ie_web } from "../twitter/twitter.js"; // consider renaming later
import { saveState } from "../utils/stateStoreCloud.js";

import { fetchHinduArticle } from "./fetchHinduArticle.js";
import { getHinduImageUrl } from "./getHinduImage.js";
import { isHinduArticle, normalizeHinduLink } from "./hinduFilters.js";
import { fetchHinduCricketRSS } from "./hinduRssFetcher.js";
import { parseHinduArticle } from "./parseHinduArticle.js";

import { generateGeminiTweet } from "../ai/generate-gemini-tweet.js";
import { generateClaudeTweet } from "../ai/generateClaudeTweet.js";
import { normalizeHinduImageUrl } from "../indian-express/ai/imageDetector.js";
import { judgeNewsContext } from "./ai/judgeNewsContext.js";

export async function hinduNewsPollingLoop() {
  if (!global.STATE) {
    console.log("⚠️ global.STATE not ready. Skipping Hindu polling.");
    return;
  }

  const STATE = global.STATE;

  // ── Init state ─────────────────────────────────────────────
  STATE.hindu ??= {};
  STATE.hindu.seen ??= {};

  const today = getTodayUTC();
  if (!STATE.dailyContext || STATE.dailyContext.date !== today) {
    STATE.dailyContext = {
      date: today,
      contexts: [],
    };
  }

  // ── Config ────────────────────────────────────────────────
  // const MAX_AGE_HOURS = 24;
  const MAX_AGE_MIN = 60;
  const SEEN_RETENTION_HOURS = 6;
  const CONSOLE_ONLY = process.env.CONSOLE_ONLY === "true";

  // const MAX_AGE_MS = MAX_AGE_HOURS * 60 * 60 * 1000;
  const SEEN_RETENTION_MS = SEEN_RETENTION_HOURS * 60 * 60 * 1000;

  try {
    // ── Prune seen cache ─────────────────────────────────────
    const now = Date.now();
    let pruned = 0;

    for (const [link, ts] of Object.entries(STATE.hindu.seen)) {
      if (now - ts > SEEN_RETENTION_MS) {
        delete STATE.hindu.seen[link];
        pruned++;
      }
    }

    if (pruned) {
      console.log(`🧹 Pruned ${pruned} old Hindu seen entries`);
    }

    // ── Fetch RSS ────────────────────────────────────────────
    const items = await fetchHinduCricketRSS();
    if (!Array.isArray(items) || items.length === 0) {
      console.log("ℹ️ No Hindu RSS items");
      return;
    }

    const sorted = items
      .filter(isHinduArticle)
      .sort((a, b) => getPubDate(b) - getPubDate(a));

    let selected = null;

    for (const item of sorted) {
      const pubMs = getPubDate(item);
      if (!pubMs) continue;
      const ageMin = (Date.now() - pubMs) / 60000;
      if (ageMin > MAX_AGE_MIN) continue;

      const cleanLink = normalizeHinduLink(item.link);
      if (STATE.hindu.seen[cleanLink]) continue;

      selected = item;
      break;
    }

    if (!selected) {
      console.log("🟡 No eligible Hindu articles");
      return;
    }

    // ── Fetch + parse ────────────────────────────────────────
    const html = await fetchHinduArticle(selected.link);
    const parsed = parseHinduArticle(html);

    if (!parsed?.body || parsed.body.length < 80) {
      console.warn("⚠️ Hindu article body too short");
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
        console.log(
          "🔁 Hindu context already covered — skipping",
          STATE.dailyContext.contexts.map((c) => c.summary)
        );

        const cleanLink = normalizeHinduLink(selected.link);
        STATE.hindu.seen[cleanLink] = Date.now();
        STATE.hindu.lastLink = cleanLink;
        STATE.hindu.lastTitle = selected.title;
        STATE.hindu.visibleDate = new Date(getPubDate(selected)).toUTCString();

        await saveState(STATE);
        return;
      }
    } catch (err) {
      console.warn("⚠️ Context judge failed (Hindu), proceeding:", err.message);
    }

    let tweetBody;

    console.log("The Hindi News Link:::", normalizeHinduLink(selected.link));

    try {
      try {
        tweetBody = await generateClaudeTweet(
          `${parsed.headline}\n${parsed.body}`
        );
      } catch (err) {
        console.warn("⚠️ Claude failed:", err?.message || err);
      }

      if (!tweetBody) {
        try {
          tweetBody = await generateGeminiTweet(
            `${parsed.headline}\n${parsed.body}`
          );
        } catch (err) {
          console.warn("⚠️ Gemini failed:", err?.message || err);
        }
      }

      console.log("tweetBody IE::", tweetBody);

      if (!tweetBody || tweetBody.length < 30) {
        throw new Error("AI output invalid");
      }
    } catch (err) {
      console.warn("⚠️ IE AI failed, skipping tweet:", err.message);
      return;
    }

    const cleanUrl = normalizeHinduLink(selected.link);
    const imageUrl = getHinduImageUrl(selected);

    imageUrl = normalizeHinduImageUrl(imageUrl);

    let tweetText = `${tweetBody}`;

    if (CONSOLE_ONLY) {
      console.log("🟡 CONSOLE MODE — Tweet skipped");
      console.log(tweetText);
    } else {
      try {
        if (imageUrl) {
          await tweetWithNativeImage({ text: tweetText, imageUrl });
        } else {
          await postTweet_ie_web({ text: tweetText });
        }
      } catch (err) {
        console.warn(
          "⚠️ Hindu image tweet failed, fallback to text-only:",
          err.message
        );
        await postTweet_ie_web({ text: tweetText });
      }
    }

    // ── Update state ─────────────────────────────────────────
    STATE.hindu.seen[cleanUrl] = Date.now();
    STATE.hindu.lastPubMs = Math.max(
      STATE.hindu.lastPubMs || 0,
      getPubDate(selected)
    );
    STATE.hindu.lastLink = cleanUrl;
    STATE.hindu.lastTitle = selected.title;
    STATE.hindu.visibleDate = new Date(getPubDate(selected)).toUTCString();

    if (contextDecision?.newContext) {
      STATE.dailyContext.contexts.push({
        summary: contextDecision.newContext,
        source: "HINDU",
        link: cleanUrl,
        createdAt: new Date().toISOString(),
      });
    }

    await saveState(STATE);
    console.log("🟢 Hindu state + dailyContext saved");
  } catch (err) {
    console.error("❌ ERROR in Hindu polling:", err);
  }
}

// ── Helpers ────────────────────────────────────────────────
function getPubDate(item) {
  return item?.pubDate ? new Date(item.pubDate).getTime() : 0;
}

function getTodayUTC() {
  return new Date().toISOString().slice(0, 10);
}
