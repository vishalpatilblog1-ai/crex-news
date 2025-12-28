import { postTweet_ie_web } from "../twitter/twitter.js"; // consider renaming later
import { saveState } from "../utils/stateStoreCloud.js";

import { fetchHinduCricketRSS } from "./hinduRssFetcher.js";
import { isHinduArticle, normalizeHinduLink } from "./hinduFilters.js";
import { fetchHinduArticle } from "./fetchHinduArticle.js";
import { parseHinduArticle } from "./parseHinduArticle.js";

import { generateHinduNewsTweet } from "./ai/generateHinduNewsTweet.js";
import { generateHinduFallbackTweet } from "./ai/generateHinduFallbackTweet.js";
import { judgeNewsContext } from "./ai/judgeNewsContext.js";

export async function hinduNewsPollingLoop() {
  if (!global.STATE) return;

  const STATE = global.STATE;

  if (!STATE.hindu) STATE.hindu = {};
  if (!STATE.hindu.seen) STATE.hindu.seen = {};

  // 🔒 Fail-safe dailyContext (index.js owns reset)
  if (!STATE.dailyContext || !Array.isArray(STATE.dailyContext.contexts)) {
    STATE.dailyContext = {
      date: getTodayUTC(),
      contexts: [],
    };
  }

  const MAX_AGE_HOURS = Number(process.env.HINDU_MAX_AGE_HOURS || 24);
  const SEEN_RETENTION_HOURS = Number(
    process.env.HINDU_SEEN_RETENTION_HOURS || 48
  );
  const CONSOLE_ONLY = process.env.CONSOLE_ONLY === "true";

  const MAX_AGE_MS = MAX_AGE_HOURS * 60 * 60 * 1000;
  const SEEN_RETENTION_MS = SEEN_RETENTION_HOURS * 60 * 60 * 1000;

  try {
    // 🧹 Prune old seen entries (same as BBC / IE)
    const now = Date.now();
    let pruned = 0;

    for (const [link, ts] of Object.entries(STATE.hindu.seen)) {
      if (now - ts > SEEN_RETENTION_MS) {
        delete STATE.hindu.seen[link];
        pruned++;
      }
    }

    if (pruned > 0) {
      console.log(`🧹 Pruned ${pruned} old Hindu seen entries`);
    }

    // 📰 Fetch RSS
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
      if (Date.now() - pubMs > MAX_AGE_MS) continue;

      const cleanLink = normalizeHinduLink(item.link);
      if (STATE.hindu.seen[cleanLink]) continue;

      selected = item;
      break;
    }

    if (!selected) {
      console.log("🟡 No eligible Hindu articles");
      return;
    }

    // 📄 Fetch + parse
    const html = await fetchHinduArticle(selected.link);
    const parsed = parseHinduArticle(html);

    if (!parsed?.body || parsed.body.length < 80) {
      console.warn("⚠️ Hindu article body too short");
      return;
    }

    // 🧠 Context judge
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
        console.log("🔁 Hindu context already covered — skipping");
        STATE.hindu.seen[normalizeHinduLink(selected.link)] = Date.now();
        await saveState(STATE);
        return;
      }
    } catch (err) {
      console.warn("⚠️ Context judge failed (Hindu), proceeding:", err.message);
    }

    // ✍️ Tweet generation
    let tweetBody;
    try {
      tweetBody = await generateHinduNewsTweet(parsed.body);
      if (!tweetBody || tweetBody.length < 30) {
        throw new Error("AI output invalid");
      }
    } catch (err) {
      console.warn("⚠️ Hindu AI failed:", err.message);
      tweetBody = generateHinduFallbackTweet(selected);
    }

    const cleanUrl = normalizeHinduLink(selected.link);
    const tweetText = `${tweetBody}\n\nThe Hindu 🔗 ${cleanUrl}`;

    if (CONSOLE_ONLY) {
      console.log("🟡 CONSOLE MODE — Tweet skipped");
      console.log(tweetText);
    } else {
      await postTweet_ie_web({ text: tweetText });
    }

    // 💾 Save state
    STATE.hindu.seen[cleanUrl] = Date.now();
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

function getPubDate(item) {
  return item?.pubDate ? new Date(item.pubDate).getTime() : 0;
}

function getTodayUTC() {
  return new Date().toISOString().slice(0, 10);
}
