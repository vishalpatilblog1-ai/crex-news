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

  const MAX_AGE_MIN = 300; // ESPN is slower
  const originalItems = await fetchESPNRss();
  const items = originalItems.slice(0, 10); // latest 15 only

  // console.log("items:::", items);

  if (!items.length) return false;

  const sorted = items.filter(isESPNArticle);

  // console.log("sorted:::", sorted);

  let selected = null;
  for (const item of sorted) {
    const parsed = await parseESPNArticle({
      storyId: item.canonicalId,
      title: item.title,
    });

    // console.log("parsed::", parsed);

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
  let tweetText = null;

  // console.log("selected:::", selected);
  // const cleanUrl = normalizeESPNLink(selected.link);
  // const article = await parseESPNArticle(selected);
  // const article = await parseESPNArticle({ url: selected.link });
  // const cleanUrl = normalizeESPNLink(selected.link);
  // if (!article?.body || article.body.length < 80) {
  //   STATE.espn.seen[cleanUrl] = Date.now();
  //   await saveState(STATE);
  //   return false;
  // }

  // console.log("article::", article);

  // tweetText = await generateGeminiTweet(`${article.headline}\n${article.body}`);

  // console.log(
  //   `generateGeminiTweet input>>>>>> ${selected.headline}\n${selected.body}`
  // );

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
    console.log("❌ AI failed — skipping without marking seen");
    return false;
  }

  console.log("tweetText>>>", tweetText);

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
