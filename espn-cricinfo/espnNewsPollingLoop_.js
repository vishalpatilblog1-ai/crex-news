// espn-cricinfo/espnNewsPollingLoop.js

import { fetchESPNRss } from "./fetchESPNRss.js";
import { isESPNArticle, normalizeESPNLink } from "./espnFilters.js";

import { generateGeminiTweet } from "../ai/generate-gemini-tweet.js";
import { generateGPTTweet } from "../ai/generate-gpt-tweet.js";
import { enqueueTweet } from "../twitter/tweetQueue.js";
import { saveState } from "../utils/stateStoreCloud.js";
import { parseESPNArticle } from "./parseESPNArticle.js";

export async function espnNewsPollingLoop() {
  console.log("espnNewsPollingLoop started ...");
  if (!global.STATE) return false;

  const STATE = global.STATE;

  STATE.espn ??= {};
  STATE.espn.seen ??= {};

  const MAX_AGE_MIN = 900; // ESPN is slower
  const items = await fetchESPNRss();

  // console.log("items:::", items);

  if (!items.length) return false;

  const sorted = items.filter(isESPNArticle);

  let selected = null;

  for (const item of sorted) {
    const parsed = parseESPNArticle(item);
    if (!parsed?.link || !parsed?.pubDate) continue;

    const ageMin = (Date.now() - parsed.pubDate) / 60000;
    if (ageMin > MAX_AGE_MIN) continue;

    const cleanLink = normalizeESPNLink(parsed.link);
    if (STATE.espn.seen[cleanLink]) continue;

    selected = parsed;
    break;
  }

  if (!selected) return false;

  let tweetText = null;

  console.log("selected:::", selected);

  const article = await parseESPNArticle(selected);
  if (!article?.body || article.body.length < 80) {
    STATE.espn.seen[cleanUrl] = Date.now();
    await saveState(STATE);
    return false;
  }

  tweetText = await generateGeminiTweet(`${article.headline}\n${article.body}`);

  try {
    tweetText = await generateGeminiTweet(
      `${selected.headline}\n${selected.body}`
    );
  } catch {}

  if (!tweetText) {
    try {
      tweetText = await generateGPTTweet(
        `${selected.headline}\n${selected.body}`
      );
    } catch {}
  }

  if (!tweetText || tweetText.length < 30) {
    STATE.espn.seen[normalizeESPNLink(selected.link)] = Date.now();
    await saveState(STATE);
    i;
    return false;
  }

  // explicit attribution (like IE)
  tweetText += "\n\n[Source – ESPNcricinfo]";

  const cleanUrl = normalizeESPNLink(selected.link);

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
