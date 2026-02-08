//googleNewsPollingLoop.js
import { generateGeminiTweet } from "../ai/generate-gemini-tweet.js";
import { generateGPTTweet } from "../ai/generate-gpt-tweet.js";
import { judgeNewsContext } from "../indian-express/ai/judgeNewsContext.js";
import { applySourceSignature, enqueueTweet } from "../twitter/tweetQueue.js";
import { saveState } from "../utils/stateStoreCloud.js";
import { geminiDiscoveryLoop } from "./ai/geminiDiscoveryLoop.js";

let isRunning = false;

export async function googleNewsPollingLoop() {
  if (isRunning) return;
  isRunning = true;

  try {
    const decision = await geminiDiscoveryLoop();
    if (!decision) return;

    const STATE = global.STATE;
    STATE.dailyContext ??= { contexts: [] };

    const contextDecision = await judgeNewsContext({
      articleText: decision.articleFullText,
      existingContexts: STATE.dailyContext.contexts.map((c) => c.summary),
    });

    if (contextDecision?.isAlreadyCovered) return;

    let tweetText =
      (await generateGeminiTweet(decision.articleFullText)) ||
      (await generateGPTTweet(decision.articleFullText));

    if (!tweetText) return;

    tweetText = applySourceSignature(tweetText, "GN");
    console.log("Gemini decision::", decision);
    console.log("tweetText generated::", tweetText);

    enqueueTweet({
      id: `${decision.sourceUrl}`,
      source: "GN",
      text: tweetText,
      imageUrl: decision.imageUrl || null,
    });

    STATE.dailyContext.contexts.push({
      summary: contextDecision.newContext,
      source: "GN",
      link: decision.sourceUrl,
      createdAt: new Date().toISOString(),
    });

    await saveState(STATE);
  } finally {
    isRunning = false;
  }
}
