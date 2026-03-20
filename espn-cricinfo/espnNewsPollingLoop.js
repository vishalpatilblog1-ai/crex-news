import { fetchESPNRss } from "./fetchESPNRss.js";
import { isESPNArticle, normalizeESPNLink } from "./espnFilters.js";

import { generateGeminiTweet } from "../ai/generate-gemini-tweet.js";
import { generateGPTTweet } from "../ai/generate-gpt-tweet.js";

import {
  classifyArticle,
  generateClaudeTweet,
  generateClaudeTweetWithType,
  SIGNIFICANCE_EXEMPT_TYPES,
} from "../ai/generateClaudeTweet.js";

import { judgeNewsContext } from "../indian-express/ai/judgeNewsContext.js";

import { enqueueTweet } from "../twitter/tweetQueue.js";
import { saveState } from "../utils/stateStoreCloud.js";
import { parseESPNArticle } from "./parseESPNArticle.js";

const MAX_AGE_MIN = 60;
const SEEN_RETENTION_MS = 6 * 60 * 60 * 1000;

export async function espnNewsPollingLoop() {
  console.log("espnNewsPollingLoop started ...");
  if (!global.STATE) return false;

  const STATE = global.STATE;

  STATE.espn ??= {};
  STATE.espn.seen ??= {};

  const today = new Date().toISOString().slice(0, 10);

  if (!STATE.dailyContext || STATE.dailyContext.date !== today) {
    STATE.dailyContext = {
      date: today,
      contexts: [],
    };
  }

  // ── Prune old seen ─────────────────────────────────
  const now = Date.now();
  for (const [link, ts] of Object.entries(STATE.espn.seen)) {
    if (now - ts > SEEN_RETENTION_MS) {
      delete STATE.espn.seen[link];
    }
  }

  const originalItems = await fetchESPNRss();
  const items = originalItems.slice(0, 10);

  if (!items.length) return false;

  const sorted = items.filter(isESPNArticle);

  let selected = null;

  for (const item of sorted) {
    const parsed = await parseESPNArticle({
      storyId: item.canonicalId,
      title: item.title,
    });

    if (!parsed) continue;

    const ageMin = (Date.now() - item.pubDate) / 60000;
    if (ageMin > MAX_AGE_MIN) continue;

    const cleanUrl = normalizeESPNLink(item.link);
    if (STATE.espn.seen[cleanUrl]) continue;

    selected = {
      ...parsed,
      link: item.link,
      pubDate: item.pubDate,
    };

    break;
  }

  if (!selected) return false;

  const cleanUrl = normalizeESPNLink(selected.link);
  const fullText = `${selected.headline}\n${selected.body}`;

  // ── Step 1: Classify ───────────────────────────────
  let articleType = "general_news";
  try {
    articleType = await classifyArticle(fullText);
    console.log("🏷️ Article classified as:", articleType);
  } catch (err) {
    console.warn("⚠️ classify failed:", err?.message);
  }

  // ── Step 2: Context + significance ────────────────
  try {
    const contextDecision = await judgeNewsContext({
      articleText: selected.body,
      existingContexts: STATE.dailyContext.contexts.map((c) => c.summary),
    });

    if (
      contextDecision?.isAlreadyCovered &&
      contextDecision?.confidence >= 0.8
    ) {
      console.log("🔁 ESPN duplicate context — skipping");

      STATE.espn.seen[cleanUrl] = Date.now();
      await saveState(STATE);
      return false;
    }

    const isExempt = SIGNIFICANCE_EXEMPT_TYPES.has(articleType);
    const score = contextDecision?.significanceScore ?? 10;

    if (!isExempt && score < 7) {
      console.log(`⬇️ ESPN low significance (${score}/10) — skipping`);

      STATE.espn.seen[cleanUrl] = Date.now();
      await saveState(STATE);
      return false;
    }

    if (isExempt) {
      console.log(`🌟 ESPN exempt type (${articleType})`);
    } else {
      console.log(`✅ ESPN significance: ${score}/10`);
    }

    if (contextDecision?.newContext) {
      STATE.dailyContext.contexts.push({
        summary: contextDecision.newContext,
        source: "ESPN",
        link: cleanUrl,
        createdAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.warn("⚠️ ESPN context judge failed:", err?.message);
  }

  // ── Step 3: Tweet generation ──────────────────────
  let tweetText = null;

  try {
    const result = await generateClaudeTweetWithType(fullText, articleType);
    tweetText = result.tweetText;
  } catch {}

  if (!tweetText) {
    try {
      tweetText = await generateGPTTweet(fullText);
    } catch {}
  }

  if (!tweetText || tweetText.length < 30) {
    console.log("❌ ESPN AI failed — skipping");
    return false;
  }

  console.log("tweetText>>>", tweetText);

  // ── Enqueue ───────────────────────────────────────
  enqueueTweet({
    id: `ESPN:${cleanUrl}`,
    source: "ESPN",
    text: tweetText,
    imageUrl: selected.imageUrl || null,
    seenKey: cleanUrl,
  });

  STATE.espn.seen[cleanUrl] = Date.now();
  await saveState(STATE);

  console.log("📥 Queued ESPN article:", selected.headline);

  return true;
}
