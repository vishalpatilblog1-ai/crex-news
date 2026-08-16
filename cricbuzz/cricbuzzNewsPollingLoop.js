import {
  // classifyArticle,
  generateGPTTweetWithType,
} from "../ai/generate-gpt-tweet.js";
import {
  classifyArticle,
  generateClaudeTweetWithType,
  SIGNIFICANCE_EXEMPT_TYPES,
} from "../ai/generateClaudeTweet.js";
import { judgeNewsContext } from "../indian-express/ai/judgeNewsContext.js";
import { applySourceSignature, enqueueTweet } from "../twitter/tweetQueue.js";
import { saveState } from "../utils/stateStoreCloud.js";
import { getLiveNewsList, getNewsDetailsByNewsId } from "./cricbuzzApi.js";

const SOURCE = "CB";

const MAX_AGE_MIN = 120;
const RETENTION_MS = 6 * 60 * 60 * 1000;
const MAX_PER_POLL = 5; // cap how many tweets can queue in a single poll cycle

export async function cricbuzzNewsPollingLoop() {
  if (!global.STATE) {
    console.log("⚠️ global.STATE not ready yet. Skipping Cricbuzz polling.");
    return false;
  }

  const STATE = global.STATE;
  STATE.cricbuzz ??= {};
  STATE.cricbuzz.seen ??= {};

  await pruneSeen(STATE, RETENTION_MS);

  let queuedCount = 0;

  try {
    const newsIndex = await getLiveNewsList();
    const storyList = newsIndex?.storyList || [];

    if (storyList.length === 0) return false;

    // ---- Collect ALL unseen, non-aged-out candidates (not just the first) ----
    const candidates = [];
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

        if (ageMin > MAX_AGE_MIN) {
          console.log(
            `⏳ Cricbuzz aged out (${Math.round(ageMin)}m): ${story.hline}`,
          );
          STATE.cricbuzz.seen[newsKey] = Date.now();
          continue;
        }
      }

      // if (!isIndiaRelated(story)) {
      //   console.log(`⏭️ Cricbuzz skipped (not India/IPL): ${story.hline}`);
      //   STATE.cricbuzz.seen[newsKey] = Date.now();
      //   continue;
      // }

      candidates.push(story);
    }

    console.log(
      `📰 Cricbuzz list: ${storyList.length} stories, ${candidates.length} unseen candidates`,
    );

    if (candidates.length === 0) {
      await saveState(STATE);
      return false;
    }

    // ---- Process every candidate (up to MAX_PER_POLL) ----
    for (const selected of candidates) {
      if (queuedCount >= MAX_PER_POLL) {
        console.log(
          `⏸️ Cricbuzz hit MAX_PER_POLL (${MAX_PER_POLL}) — remaining stay unseen for next poll`,
        );
        break;
      }

      const newsId = selected.id;
      const newsKey = `cricbuzz_${newsId}`;

      const detailNews = await getNewsDetailsByNewsId(newsId);
      if (!detailNews?.content) {
        STATE.cricbuzz.seen[newsKey] = Date.now();
        continue;
      }

      const fullText = buildFullArticleText(detailNews);
      if (fullText.length < 80) {
        STATE.cricbuzz.seen[newsKey] = Date.now();
        continue;
      }

      let articleType = "player_form";
      try {
        articleType = await classifyArticle(fullText);
      } catch (err) {
        console.warn("⚠️ classifyArticle failed, using default:", err?.message);
      }

      let decision = null;
      try {
        decision = await judgeNewsContext({
          articleText: fullText,
          existingContexts:
            STATE.dailyContext?.contexts?.map((c) => c.summary) || [],
        });

        if (decision?.isAlreadyCovered && decision?.confidence >= 0.8) {
          console.log(
            "🔴 Cricbuzz skipped — already covered context:",
            selected.hline,
          );
          STATE.cricbuzz.seen[newsKey] = Date.now();
          continue;
        }

        const isExempt = SIGNIFICANCE_EXEMPT_TYPES.has(articleType);
        const score = decision?.significanceScore ?? 10;

        console.log("================ Full Article ================");
        console.log(selected.hline);
        console.log(fullText);
        console.log("================ Score =======================");
        console.log(score);

        if (!isExempt && score < 7) {
          console.log(
            `⬇️ Low significance (${score}/10) — skipping: ${selected.hline}`,
          );
          STATE.cricbuzz.seen[newsKey] = Date.now();
          continue;
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
          "⚠️ Cricbuzz judgeNewsContext failed:",
          err?.message || err,
        );
      }

      // const longEligible = isLongTweetEligible(fullText);
      const longEligible = false;
      if (longEligible) {
        console.log("📏 Cricbuzz article qualifies for long-tweet mode");
      }

      let tweetText = null;
      try {
        const result = await generateClaudeTweetWithType(
          fullText,
          articleType,
          SOURCE,
          longEligible,
        );
        tweetText = result.tweetText;
        // tweetText = await generateGullyPointVoiceTweet(fullText);
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
          continue;
        }
      }

      if (!tweetText || tweetText.length < 30) {
        console.warn("⚠️ Cricbuzz tweet generation failed / too short");
        STATE.cricbuzz.seen[newsKey] = Date.now();
        continue;
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
      queuedCount++;

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

      console.log(`📥 Queued Cricbuzz tweet: ${selected.hline}`);
    }

    await saveState(STATE);
    return queuedCount > 0;
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
