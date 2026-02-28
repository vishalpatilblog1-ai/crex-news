// import { isIEArticle, normalizeIELink } from "./ieFilters.js";
// import { parseIEArticle } from "./parseIEArticle.js";
// import { fetchIEArticle } from "./fetchIEArticle.js";
// import { judgeNewsContext } from "./ai/judgeNewsContext.js";
import { judgeNewsContext } from "./indian-express/ai/judgeNewsContext.js";
import { fetchIEArticle } from "./indian-express/fetchIEArticle.js";
import { isIEArticle, normalizeIELink } from "./indian-express/ieFilters.js";
import { parseIEArticle } from "./indian-express/parseIEArticle.js";

const testItem = {
  title: "Pakistan vs Sri Lanka Live Score, T20 World Cup 2026...",
  link: "https://indianexpress.com/article/sports/cricket/pakistan-vs-sri-lanka-live-score-pak-vs-sl-t20-world-cup-super-8-match-live-cricket-scorecard-updates-10557392/",
  pubDate: "Tue, 28 Feb 2026 18:51:00 GMT",
};

export async function debugIEArticle(testItem) {
  const MAX_AGE_MIN = 300;
  console.log("========== DEBUG START ==========");

  if (!isIEArticle(testItem)) {
    console.log("❌ Gate 1 FAILED: isIEArticle");
    return;
  }
  console.log("✅ Gate 1 PASSED: isIEArticle");

  const pubMs = testItem?.pubDate ? new Date(testItem.pubDate).getTime() : 0;

  const ageMin = (Date.now() - pubMs) / 60000;

  console.log("AgeMin:", ageMin);

  if (ageMin > MAX_AGE_MIN) {
    console.log("❌ Gate 2 FAILED: Age filter");
    return;
  }
  console.log("✅ Gate 2 PASSED: Age filter");

  const cleanLink = normalizeIELink(testItem.link);

  if (global.STATE?.ie?.seen?.[cleanLink]) {
    console.log("❌ Gate 3 FAILED: Already in STATE.ie.seen");
    return;
  }
  console.log("✅ Gate 3 PASSED: Not in seen");

  const html = await fetchIEArticle(testItem.link);
  const parsed = parseIEArticle(html);

  if (!parsed?.body || parsed.body.length < 80) {
    console.log("❌ Gate 4 FAILED: Body too short");
    console.log("Body length:", parsed?.body?.length);
    return;
  }
  console.log("✅ Gate 4 PASSED: Body length OK");

  const contextDecision = await judgeNewsContext({
    articleText: parsed.body,
    existingContexts:
      global.STATE?.dailyContext?.contexts?.map((c) => c.summary) || [],
  });

  console.log("ContextDecision:", contextDecision);

  if (
    contextDecision?.isAlreadyCovered === true &&
    contextDecision?.confidence >= 0.8
  ) {
    console.log("❌ Gate 5 FAILED: Context dedupe triggered");
    return;
  }

  console.log("✅ Gate 5 PASSED: Context OK");
  console.log("🎉 Article would be selected.");
  console.log("========== DEBUG END ==========");
}

// 👇 CALL IT
global.STATE = {
  ie: { seen: {} },
  dailyContext: { contexts: [] },
};

debugIEArticle(testItem)
  .then(() => console.log("Debug completed"))
  .catch(console.error);
