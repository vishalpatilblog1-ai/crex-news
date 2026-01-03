// ieNewsPollingLoop.js

import { tweetWithNativeImage } from "../twitter/tweetWithImage.js";
import { postTweet_ie_web } from "../twitter/twitter.js";
import { saveState } from "../utils/stateStoreCloud.js";

import { generateIEFallbackTweet } from "./ai/generateIEFallbackTweet.js";
import { generateIENewsTweet } from "./ai/generateIENewsTweet.js";
import { judgeNewsContext } from "./ai/judgeNewsContext.js";

import { fetchIEArticle } from "./fetchIEArticle.js";
import { getIEImageUrl } from "./getIEImageUrl.js";
import { isIEArticle, normalizeIELink } from "./ieFilters.js";
import { fetchIECricketRSS } from "./ieRssFetcher.js";
import { parseIEArticle } from "./parseIEArticle.js";

export async function ieNewsPollingLoop() {
  if (!global.STATE) {
    console.log("⚠️ global.STATE not ready. Skipping IE polling.");
    return;
  }

  const STATE = global.STATE;

  if (!STATE.ie) STATE.ie = {};
  if (!STATE.ie.seen) STATE.ie.seen = {};

  // 🔒 Fail-safe (index.js should already init this)
  if (!STATE.dailyContext || !Array.isArray(STATE.dailyContext.contexts)) {
    STATE.dailyContext = {
      date: getTodayUTC(),
      contexts: [],
    };
  }

  const MAX_AGE_HOURS = Number(process.env.IE_MAX_AGE_HOURS || 24);
  const SEEN_RETENTION_HOURS = Number(
    process.env.IE_SEEN_RETENTION_HOURS || 48
  );
  const CONSOLE_ONLY = process.env.CONSOLE_ONLY === "true";

  const MAX_AGE_MS = MAX_AGE_HOURS * 60 * 60 * 1000;
  const SEEN_RETENTION_MS = SEEN_RETENTION_HOURS * 60 * 60 * 1000;

  try {
    // 🧹 Prune old seen entries (sliding window)
    const now = Date.now();
    let pruned = 0;

    for (const [link, ts] of Object.entries(STATE.ie.seen)) {
      if (now - ts > SEEN_RETENTION_MS) {
        delete STATE.ie.seen[link];
        pruned++;
      }
    }

    if (pruned > 0) {
      console.log(`🧹 Pruned ${pruned} old IE seen entries`);
    }

    // 📰 Fetch RSS
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

      // ⏱️ Age gate (same as BBC)
      if (Date.now() - pubMs > MAX_AGE_MS) continue;

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

    // 📄 Fetch + parse
    const html = await fetchIEArticle(selected.link);
    const parsed = parseIEArticle(html);

    if (!parsed?.body || parsed.body.length < 80) {
      console.warn("⚠️ IE article body missing / too short");
      return;
    }

    // 🧠 Context dedupe (shared dailyContext)
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
        console.log("🔁 Skipping IE article (context already covered)");
        console.log("↳ Context:", contextDecision.newContext);

        const cleanLink = normalizeIELink(selected.link);
        STATE.ie.seen[cleanLink] = Date.now();
        await saveState(STATE);
        return;
      }
    } catch (err) {
      console.warn(
        "⚠️ IE context judge failed, proceeding without context dedup:",
        err.message
      );
    }

    // ✍️ Generate tweet
    let tweetBody;

    try {
      tweetBody = await generateIENewsTweet(parsed.body);
      if (!tweetBody || tweetBody.length < 30) {
        throw new Error("AI output invalid");
      }
    } catch (err) {
      console.warn("⚠️ IE AI failed, using fallback:", err.message);
      tweetBody = generateIEFallbackTweet(selected);
    }

    const cleanUrl = normalizeIELink(selected.link);
    // const tweetText = `${tweetBody}\n\nIndian Express 🔗 ${cleanUrl}`;
    const tweetText = `${tweetBody}\n\n[Indian Express]`;
    const imageUrl = getIEImageUrl(selected);
    console.log("imageUrl::", imageUrl);

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
          "⚠️ IE native image tweet failed, fallback to text-only:",
          err.message
        );
        await postTweet_ie_web({ text: tweetText });
      }
    }

    // 💾 Update state
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

    STATE.ie = {
      ...STATE.ie,
      lastPubMs: STATE.ie?.lastPubMs || 0,
      lastLink: STATE.ie?.lastLink || "",
      lastTitle: STATE.ie?.lastTitle || "",
      visibleDate: STATE.ie?.visibleDate || null,
      seen: STATE.ie?.seen || {},
    };

    STATE.dailyContext = {
      date: STATE.dailyContext.date,
      contexts: STATE.dailyContext.contexts || [],
    };

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
