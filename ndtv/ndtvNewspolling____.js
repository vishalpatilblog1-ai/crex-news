// ndtvnewsPollingLoop.js

import { generateGeminiTweet } from "../ai/generate-gemini-tweet.js";
import { generateClaudeTweet } from "../ai/generateClaudeTweet.js";
import { judgeNewsContext } from "../indian-express/ai/judgeNewsContext.js";
// import { fetchIEArticle } from "../indian-express/fetchIEArticle.js";
import { enqueueTweet } from "../twitter/tweetQueue.js";
import { saveState } from "../utils/stateStoreCloud.js";
import { fetchNDTVArticle } from "./fetchNDTVArticle.js";
import { getNDTVImageUrl } from "./getNDTVImageUrl.js";

// import { judgeNewsContext } from "./ai/judgeNewsContext.js";

// import { fetchIEArticle } from "./fetchIEArticle.js";
// import { getIEImageUrl } from "./getIEImageUrl.js";
import { isNDTVArticle, normalizeNDTVLink } from "./isNDTVArticle.js";
import { fetchNDTVCricketRSS } from "./ndtvRssFetcher.js";
import { parseNDTVArticle } from "./parseNDTVArticle.js";
// import { fetchIECricketRSS } from "./ieRssFetcher.js";
// import { parseIEArticle } from "./parseIEArticle.js";

export async function ndtvNewspolling____() {
  if (!global.STATE) {
    console.log("⚠️ global.STATE not ready. Skipping IE polling.");
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

  const MAX_AGE_MIN = 300;
  const SEEN_RETENTION_HOURS = 6;
  const CONSOLE_ONLY = process.env.CONSOLE_ONLY === "true";

  const SEEN_RETENTION_MS = SEEN_RETENTION_HOURS * 60 * 60 * 1000;

  try {
    const now = Date.now();
    let pruned = 0;

    for (const [link, ts] of Object.entries(STATE.ndtv.seen)) {
      if (now - ts > SEEN_RETENTION_MS) {
        delete STATE.ndtv.seen[link];
        pruned++;
      }
    }

    if (pruned) {
      console.log(`🧹 Pruned ${pruned} old IE seen entries`);
    }

    const items = await fetchNDTVCricketRSS();
    if (!Array.isArray(items) || items.length === 0) {
      console.log("ℹ️ No IE RSS items");
      return;
    }

    const sorted = items
      .filter(isNDTVArticle)
      .sort((a, b) => getPubDate(b) - getPubDate(a));

    let selected = null;

    // console.log("sorted::", sorted);

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
      console.log("🟡 No eligible IE articles (age + dedupe)");
      return;
    }

    const html = await fetchNDTVArticle(selected.link);

    // const parsed = parseNDTVArticle(html);

    // if (!parsed?.body || parsed.body.length < 80) {
    //   console.warn("⚠️ IE article body missing / too short");
    //   return;
    // }

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
        const cleanLink = normalizeNDTVLink(selected.link);
        STATE.ndtv.seen[cleanLink] = Date.now();
        STATE.ndtv.lastLink = cleanLink;
        STATE.ndtv.lastTitle = selected.title;
        STATE.ndtv.visibleDate = new Date(getPubDate(selected)).toUTCString();

        // await saveState(STATE);
        return;
      }
    } catch (err) {
      console.warn(
        "⚠️ NDTV context judge failed, proceeding without dedup:",
        err.message
      );
    }

    let tweetBody;

    console.log("ndtv data::", parsed.headline, parsed.body);

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

    let imageUrl = getNDTVImageUrl(selected);

    if (!imageUrl) {
      console.log("🚫 Skipping IE article — no image found");
      const cleanUrl = normalizeNDTVLink(selected.link);
      STATE.ndtv.seen[cleanUrl] = Date.now();
      STATE.ndtv.lastLink = cleanUrl;
      STATE.ndtv.lastTitle = selected.title;
      STATE.ndtv.visibleDate = new Date(getPubDate(selected)).toUTCString();

      await saveState(STATE);
      return;
    }

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
      imageUrl,
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
