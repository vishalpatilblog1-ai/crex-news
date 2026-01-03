// probatsmanNewsPollingLoop.js
import { postTweet_ie_web } from "../twitter/twitter.js";
import { saveState } from "../utils/stateStoreCloud.js";

import { fetchProBatsmanRSS } from "./probatsmanRssFetcher.js";
import {
  isProBatsmanArticle,
  normalizeProBatsmanLink,
} from "./probatsmanFilters.js";
import { parseProBatsmanArticle } from "./parseProBatsmanArticle.js";
import { getProBatsmanImageUrl } from "./getProBatsmanImage.js";

import { generateProBatsmanNewsTweet } from "./ai/generateProBatsmanNewsTweet.js";
import { generateProBatsmanFallbackTweet } from "./ai/generateProBatsmanFallbackTweet.js";
import { judgeNewsContext } from "./ai/judgeNewsContext.js";
import { tweetWithNativeImage } from "../twitter/tweetWithImage.js";

export async function probatsmanNewsPollingLoop() {
  if (!global.STATE) return;

  const STATE = global.STATE;
  if (!STATE.probatsman) STATE.probatsman = {};
  if (!STATE.probatsman.seen) STATE.probatsman.seen = {};

  const MAX_AGE_HOURS = Number(process.env.PROBATSMAN_MAX_AGE_HOURS || 24);
  const SEEN_RETENTION_HOURS = Number(
    process.env.PROBATSMAN_SEEN_RETENTION_HOURS || 48
  );
  const CONSOLE_ONLY = process.env.CONSOLE_ONLY === "true";

  const MAX_AGE_MS = MAX_AGE_HOURS * 60 * 60 * 1000;
  const SEEN_RETENTION_MS = SEEN_RETENTION_HOURS * 60 * 60 * 1000;

  try {
    // 🧹 Prune old seen
    const now = Date.now();
    for (const [link, ts] of Object.entries(STATE.probatsman.seen)) {
      if (now - ts > SEEN_RETENTION_MS) {
        delete STATE.probatsman.seen[link];
      }
    }

    // 📰 Fetch RSS
    const items = await fetchProBatsmanRSS();
    if (!items.length) return;

    const sorted = items
      .filter(isProBatsmanArticle)
      .sort((a, b) => getPubDate(b) - getPubDate(a));

    let selected = null;

    for (const item of sorted) {
      const pubMs = getPubDate(item);
      if (!pubMs || Date.now() - pubMs > MAX_AGE_MS) continue;

      const cleanLink = normalizeProBatsmanLink(item.link);
      if (STATE.probatsman.seen[cleanLink]) continue;

      selected = item;
      break;
    }

    if (!selected) return;

    // 📄 Parse from RSS content
    const parsed = parseProBatsmanArticle(
      selected["content:encoded"] || selected.description || ""
    );

    if (!parsed?.body || parsed.body.length < 80) return;
    let contextDecision = null;

    try {
      contextDecision = await judgeNewsContext({
        articleText: parsed.body,
        existingContexts:
          STATE.dailyContext?.contexts?.map((c) => c.summary) || [],
      });

      if (
        contextDecision?.isAlreadyCovered &&
        contextDecision?.confidence >= 0.8
      ) {
        STATE.probatsman.seen[normalizeProBatsmanLink(selected.link)] =
          Date.now();
        await saveState(STATE);
        return;
      }
    } catch {}

    // ✍️ Tweet
    let tweetBody;
    try {
      tweetBody = await generateProBatsmanNewsTweet(parsed.body);
      if (!tweetBody || tweetBody.length < 30) throw new Error();
    } catch {
      tweetBody = generateProBatsmanFallbackTweet(selected);
    }

    const cleanUrl = normalizeProBatsmanLink(selected.link);
    const tweetText = `${tweetBody}`;
    const imageUrl = getProBatsmanImageUrl(selected);

    if (CONSOLE_ONLY) {
      console.log("🟡 CONSOLE MODE — Tweet skipped");
      console.log(tweetText);
    } else {
      try {
        if (imageUrl) {
          await tweetWithNativeImage({
            text: tweetText,
            imageUrl,
          });
        } else {
          await postTweet_ie_web({ text: tweetText });
        }
      } catch (err) {
        console.warn(
          "⚠️ Native image tweet failed, falling back to text-only:",
          err.message
        );
        await postTweet_ie_web({ text: tweetText });
      }
    }

    // 💾 Save state
    STATE.probatsman.seen[cleanUrl] = Date.now();
    STATE.probatsman.lastLink = cleanUrl;
    STATE.probatsman.lastTitle = selected.title;
    STATE.probatsman.visibleDate = new Date(getPubDate(selected)).toUTCString();

    if (contextDecision?.newContext) {
      STATE.dailyContext.contexts.push({
        summary: contextDecision.newContext,
        source: "ProBatsman",
        link: cleanUrl,
        createdAt: new Date().toISOString(),
      });
    }

    STATE.probatsman = {
      ...STATE.probatsman,
      lastPubMs: STATE.probatsman?.lastPubMs || 0,
      lastLink: STATE.probatsman?.lastLink || "",
      lastTitle: STATE.probatsman?.lastTitle || "",
      visibleDate: STATE.probatsman?.visibleDate || null,
      seen: STATE.probatsman?.seen || {},
    };

    STATE.dailyContext = {
      date: STATE.dailyContext.date,
      contexts: STATE.dailyContext.contexts || [],
    };

    await saveState(STATE);
    console.log("🟢 ProBatsman state saved");
  } catch (err) {
    console.error("❌ ERROR in ProBatsman polling:", err);
  }
}

function getPubDate(item) {
  return item?.pubDate ? new Date(item.pubDate).getTime() : 0;
}
