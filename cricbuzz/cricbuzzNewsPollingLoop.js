import { generateGeminiTweet } from "../ai/generate-gemini-tweet.js";
import { generateGPTTweet } from "../ai/generate-gpt-tweet.js";
import { generateClaudeTweet } from "../ai/generateClaudeTweet.js";
import { judgeNewsContext } from "../indian-express/ai/judgeNewsContext.js";
import { tweetNewsWithImage } from "../twitter/tweetNewsWithImage.js";
import { applySourceSignature, enqueueTweet } from "../twitter/tweetQueue.js";
import { saveState } from "../utils/stateStoreCloud.js";
import { getLiveNewsList, getNewsDetailsByNewsId } from "./cricbuzzApi.js";

const BASE_IMAGE_URL = "https://static.cricbuzz.com";

const MAX_AGE_MIN = 120;

const RETENTION_MS = 4 * 60 * 60 * 1000; // 4 hours
const CONSOLE_ONLY = process.env.CONSOLE_ONLY === "true";

export async function cricbuzzNewsPollingLoop() {
  if (!global.STATE) {
    console.log("⚠️ global.STATE not ready yet. Skipping Cricbuzz polling.");
    return false;
  }

  const STATE = global.STATE;
  STATE.cricbuzz ??= {};
  STATE.cricbuzz.seen ??= {};
  // STATE.cricbuzz.queued ??= {};

  await pruneSeen(STATE, RETENTION_MS);

  try {
    const newsIndex = await getLiveNewsList();
    const storyList = newsIndex?.storyList || [];

    if (storyList.length === 0) return false;

    let selected = null;

    /* ---------------- CT-style selection ---------------- */
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

      selected = story;
      break; // 🔑 SINGLE ITEM ONLY
    }

    if (!selected) return false;

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
    } catch (err) {
      console.warn("⚠️ Cricbuzz judgeNewsContext failed:", err?.message || err);
    }

    let tweetText = null;
    try {
      tweetText = await generateClaudeTweet(fullText);
    } catch (err) {
      console.warn("⚠️ Claude failed:", err?.message || err);
    }

    if (!tweetText || tweetText.trim().length < 30) {
      try {
        tweetText = await generateGPTTweet(fullText);
      } catch (err) {
        console.warn("⚠️ Cricbuzz AI failed, skipping tweet:", err.message);
        return; // exit without posting
      }
    }

    if (!tweetText || tweetText.length < 30) {
      console.warn("⚠️ Cricbuzz tweet generation failed / too short");
      STATE.cricbuzz.seen[newsKey] = Date.now();
      await saveState(STATE);
      return false;
    }

    const imageId = selected.imageId || selected.coverImage?.id;
    tweetText = applySourceSignature(tweetText, "CB");

    const imageUrl = imageId
      ? `${BASE_IMAGE_URL}/a/img/v1/1080x608/i1/c${imageId}/i.jpg`
      : null;

    const tweetId = `CB:${newsKey}`;

    enqueueTweet({
      id: tweetId,
      source: "CB",
      text: tweetText,
      imageUrl,
      seenKey: newsKey,
    });
    STATE.cricbuzz.seen[newsKey] = Date.now();
    // STATE.cricbuzz.queued[newsKey] = Date.now();

    // STATE.cricktracker.seen[cleanLink] = Date.now();
    // if (decision?.newContext && !contextExists(STATE, decision.newContext)) {
    //   STATE.dailyContext.contexts.push({
    //     summary: decision.newContext,
    //     source: "CT",
    //     link: cleanLink,
    //     createdAt: new Date().toISOString(),
    //   });
    // }

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
