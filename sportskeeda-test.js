// sportskeeda/sportskeeda-test.js

import { generateGeminiTweet } from "./ai/generate-gemini-tweet.js";
import { generateGPTTweet } from "./ai/generate-gpt-tweet.js";
import { normalizeSportskeedaLink } from "./espn-cricinfo/normalizeSportskeedaLink.js";
import { parseSportskeedaArticle } from "./espn-cricinfo/parseSportskeedaArticle.js";
import { judgeNewsContext } from "./indian-express/ai/judgeNewsContext.js";
import { enqueueTweet } from "./twitter/tweetQueue.js";
import { loadState, saveState } from "./utils/stateStoreCloud.js";

// import { parseSportskeedaArticle } from "./parseSportskeedaArticle.js";

async function run() {
  global.STATE = await loadState();
  if (!global.STATE) return false;
  const STATE = global.STATE;

  const link =
    "https://www.sportskeeda.com/cricket/news-steal-auction-fans-react-kkr-overseas-stars-go-berserk-nz-vs-uae-t20-world-cup-2026-match";

  if (!link) {
    console.error("❌ Please provide a Sportskeeda article URL");
    console.error("Usage:\nnode sportskeeda-test.js <sportskeeda-article-url>");
    process.exit(1);
  }

  console.log("🔍 Testing Sportskeeda parser");
  console.log("🔗 URL:", link);
  console.log("────────────────────────────────────");

  const parsed = await parseSportskeedaArticle({ link });
  const cleanUrl = normalizeSportskeedaLink(link);

  if (!parsed?.headline || !parsed?.body || parsed.body.length < 80) {
    STATE.sportskeeda.seen[cleanUrl] = Date.now();
    await saveState(STATE);
    return false;
  }

  let decision = null;
  try {
    decision = await judgeNewsContext({
      articleText: `${parsed.headline}\n${parsed.body}`,
      existingContexts:
        STATE.dailyContext?.contexts?.map((c) => c.summary) || [],
    });

    if (decision?.isAlreadyCovered && decision?.confidence >= 0.8) {
      STATE.sportskeeda.seen[cleanUrl] = Date.now();
      await saveState(STATE);
      return false;
    }
  } catch (err) {
    console.warn("⚠️ judgeNewsContext failed:", err?.message || err);
  }

  console.log("result:::", parsed);

  let tweetText = null;

  try {
    tweetText = await generateGeminiTweet(`${parsed.headline}\n${parsed.body}`);
  } catch (err) {
    console.warn("⚠️ Gemini failed:", err?.message || err);
  }

  if (!tweetText) {
    try {
      tweetText = await generateGPTTweet(`${parsed.headline}\n${parsed.body}`);
    } catch (err) {
      console.warn("❌ GPT failed:", err?.message || err);
    }
  }

  if (!tweetText || tweetText.length < 30) {
    STATE.sportskeeda.seen[cleanUrl] = Date.now();
    await saveState(STATE);
    return false;
  }

  const imageUrl = parsed.imageUrl;

  console.log("tweetText::", tweetText);
  console.log("imageUrl::", imageUrl);

  enqueueTweet({
    id: `SPORTSKEEDA:${cleanUrl}`,
    source: "SPORTSKEEDA",
    text: tweetText,
    imageUrl: imageUrl,
    seenKey: cleanUrl,
  });

  //   const { useImage } = await decideImageUsage({
  //     imageUrl,
  //     usedImages: STATE.usedImages,
  //   });

  //   tweetText = applySourceSignature(tweetText, "SK");

  if (!parsed) {
    console.error("❌ Parser returned null");
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("🔥 Test crashed:", err);
  process.exit(1);
});
