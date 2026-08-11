import {
  classifyArticle,
  generateClaudeTweetWithType,
  SIGNIFICANCE_EXEMPT_TYPES,
} from "../ai/generateClaudeTweet.js";
import {
  generateGPTTweetWithType,
  isLongTweetEligible,
} from "../ai/generate-gpt-tweet.js";
import { isIndiaRelated } from "./cricbuzzFilters.js";
import { judgeNewsContext } from "../indian-express/ai/judgeNewsContext.js";
import { applySourceSignature, enqueueTweet } from "../twitter/tweetQueue.js";
import { saveState } from "../utils/stateStoreCloud.js";
import { getLiveNewsList, getNewsDetailsByNewsId } from "./cricbuzzApi.js";

const SOURCE = "CB";

const MAX_AGE_MIN = 120;
const RETENTION_MS = 4 * 60 * 60 * 1000; // 4 hours

export async function cricbuzzNewsPollingLoop() {
  if (!global.STATE) {
    console.log("⚠️ global.STATE not ready yet. Skipping Cricbuzz polling.");
    return false;
  }

  const STATE = global.STATE;
  STATE.cricbuzz ??= {};
  STATE.cricbuzz.seen ??= {};

  await pruneSeen(STATE, RETENTION_MS);

  try {
    const newsIndex = await getLiveNewsList();
    const storyList = newsIndex?.storyList || [];

    if (storyList.length === 0) return false;

    let selected = null;

    // ── Step 0: pick first unseen, fresh, India/IPL-relevant story ───────────
    // India/IPL filter runs here — before any API spend — same principle as
    // the age/seen checks: reject cheaply, in code, before paying for a
    // generation call.
    for (const item of storyList) {
      const story = item.story;
      if (!story) continue;

      const newsId = story.id;
      if (!newsId) continue;

      const newsKey = `cricbuzz_${newsId}`;
      if (STATE.cricbuzz.seen[newsKey]) continue;

      const pubMs = story.pubTime ? Number(story.pubTime) : null;
      if (pubMs) {
        const ageMin = (Date.now() - pubMs) / 60000;
        if (ageMin > MAX_AGE_MIN) continue;
      }

      if (!isIndiaRelated(story)) {
        console.log(`⏭️ Cricbuzz skipped (not India/IPL): ${story.hline}`);
        // Mark seen so we don't re-evaluate this story on every poll cycle —
        // it's not going to become India-related on a later pass.
        STATE.cricbuzz.seen[newsKey] = Date.now();
        continue;
      }

      selected = story;
      break; // 🔑 SINGLE ITEM ONLY
    }

    if (!selected) {
      await saveState(STATE);
      return false;
    }

    /* ---------------- process selected ---------------- */
    const newsId = selected.id;
    const newsKey = `cricbuzz_${newsId}`;

    const detailNews = await getNewsDetailsByNewsId(newsId);
    if (!detailNews?.content) {
      STATE.cricbuzz.seen[newsKey] = Date.now();
      await saveState(STATE);
      return false;
    }

    const fullText = buildFullArticleText(detailNews);
    if (fullText.length < 80) {
      STATE.cricbuzz.seen[newsKey] = Date.now();
      await saveState(STATE);
      return false;
    }

    // ── Step 1: Classify article type first ──────────────────────────────────
    // Classified once here so both the significance gate and generation reuse
    // it — no duplicate classification call.
    let articleType = "player_form";
    try {
      articleType = await classifyArticle(fullText);
    } catch (err) {
      console.warn("⚠️ classifyArticle failed, using default:", err?.message);
    }

    // ── Step 2: Deduplication + significance gate ─────────────────────────────
    // judgeNewsContext checks against STATE.dailyContext — the SAME shared
    // context pool that CA/SK/XNews all write into, so this is cross-source
    // dedup, not just Cricbuzz-vs-Cricbuzz.
    let decision = null;
    try {
      decision = await judgeNewsContext({
        articleText: fullText,
        existingContexts:
          STATE.dailyContext?.contexts?.map((c) => c.summary) || [],
      });

      if (decision?.isAlreadyCovered && decision?.confidence >= 0.8) {
        console.log("🔴 Cricbuzz skipped — already covered context");
        STATE.cricbuzz.seen[newsKey] = Date.now();
        await saveState(STATE);
        return false;
      }

      const isExempt = SIGNIFICANCE_EXEMPT_TYPES.has(articleType);
      const score = decision?.significanceScore ?? 10;

      if (!isExempt && score < 7) {
        console.log(
          `⬇️ Low significance (${score}/10) — skipping: ${selected.hline}`,
        );
        STATE.cricbuzz.seen[newsKey] = Date.now();
        await saveState(STATE);
        return false;
      }

      if (isExempt) {
        console.log(
          `🌟 Exempt type (${articleType}) — bypassing significance gate (score: ${score}/10)`,
        );
      } else {
        console.log(`✅ Significance: ${score}/10 — proceeding`);
      }
    } catch (err) {
      console.warn("⚠️ Cricbuzz judgeNewsContext failed:", err?.message || err);
    }

    // ── Step 3: Long-tweet eligibility ─────────────────────────────────────────
    // Cheap, no-API-call check — decides whether generation gets the extended
    // 320-420 char budget instead of the standard 200-280. Cricbuzz is our one
    // original/fast source, so it's the only one wired to this flag.
    const longEligible = isLongTweetEligible(fullText);
    if (longEligible) {
      console.log("📏 Cricbuzz article qualifies for long-tweet mode");
    }

    // ── Step 4: Tweet generation ──────────────────────────────────────────────
    // Claude primary, GPT fallback — both receive source + longEligible so
    // char-limit resolution is consistent regardless of which model ends up
    // generating the tweet.
    let tweetText = null;
    try {
      const result = await generateClaudeTweetWithType(
        fullText,
        articleType,
        SOURCE,
        longEligible,
      );
      tweetText = result.tweetText;
      console.log("Prompt generated by Claude ....");
    } catch (err) {
      console.warn("⚠️ Claude failed:", err?.message || err);
    }

    if (!tweetText || tweetText.trim().length < 30) {
      try {
        const result = await generateGPTTweetWithType(
          fullText,
          articleType,
          SOURCE,
          longEligible,
        );
        tweetText = result.tweetText;
        console.log("Prompt generated by GPT (fallback) ....");
      } catch (err) {
        console.warn("⚠️ Cricbuzz AI failed, skipping tweet:", err.message);
        return false;
      }
    }

    if (!tweetText || tweetText.length < 30) {
      console.warn("⚠️ Cricbuzz tweet generation failed / too short");
      STATE.cricbuzz.seen[newsKey] = Date.now();
      await saveState(STATE);
      return false;
    }

    tweetText = applySourceSignature(tweetText, SOURCE);

    // Text-only tweets for CB — no image, same as the current SK text-only test.
    const imageUrl = null;

    // For future if required
    //  const imageUrl = imageId
    // ? `${BASE_IMAGE_URL}/a/img/v1/1080x608/i1/c${imageId}/i.jpg`
    // : null;

    const tweetId = `${SOURCE}:${newsKey}`;

    enqueueTweet({
      id: tweetId,
      source: SOURCE,
      text: tweetText,
      imageUrl,
      seenKey: newsKey,
    });

    STATE.cricbuzz.seen[newsKey] = Date.now();

    if (decision?.newContext) {
      STATE.dailyContext ??= {
        date: new Date().toISOString().slice(0, 10),
        contexts: [],
      };
      STATE.dailyContext.contexts.push({
        summary: decision.newContext,
        source: SOURCE,
        link: newsKey,
        createdAt: new Date().toISOString(),
      });
    }

    await saveState(STATE);
    console.log(`📥 Queued Cricbuzz tweet: ${selected.hline}`);

    return true;
  } catch (err) {
    console.error("❌ Cricbuzz polling failed:", err);
    return false;
  }
}

function buildFullArticleText(detailNews) {
  return detailNews.content
    .filter((b) => b?.content?.contentType === "text")
    .map((b) => b.content.contentValue)
    .join(" ");
}

async function pruneSeen(STATE, retentionMs) {
  const now = Date.now();
  let pruned = 0;

  for (const [key, ts] of Object.entries(STATE.cricbuzz.seen || {})) {
    if (now - ts > retentionMs) {
      delete STATE.cricbuzz.seen[key];
      pruned++;
    }
  }

  if (pruned > 0) {
    console.log(`🧹 Pruned ${pruned} old Cricbuzz seen entries`);
    await saveState(STATE);
  }
}
