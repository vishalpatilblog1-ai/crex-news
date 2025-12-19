// import { postTweet_ie_web } from "../twitter/twitter.js";
import { saveState } from "../utils/stateStoreCloud.js";
import { generateIEFallbackTweet } from "./ai/generateIEFallbackTweet.js";
import { generateIENewsTweet } from "./ai/generateIENewsTweet.js";
// import { generateIEFallbackTweet } from "./ai/generateIEFallbackTweet.js";
import { isIEArticle, normalizeIELink } from "./ieFilters.js";
import { fetchIECricketRSS } from "./ieRssFetcher.js";

export async function ieNewsPollingLoop() {
  if (!global.STATE) return;

  const STATE = global.STATE;

  if (!STATE.ie) STATE.ie = {};
  if (!STATE.ie.seen) STATE.ie.seen = {};

  const MAX_AGE_HOURS = Number(process.env.IE_MAX_AGE_HOURS || 24);
  const MAX_AGE_MS = MAX_AGE_HOURS * 60 * 60 * 1000;

  try {
    const items = await fetchIECricketRSS();

    const sorted = items
      .filter(isIEArticle)
      .sort((a, b) => getPubDate(b) - getPubDate(a));

    let selected = null;

    for (const item of sorted) {
      const pubMs = getPubDate(item);
      if (!pubMs) continue;
      if (Date.now() - pubMs > MAX_AGE_MS) continue;

      const cleanLink = normalizeIELink(item.link);
      if (STATE.ie.seen[cleanLink]) continue;

      selected = item;
      break;
    }

    if (!selected) {
      console.log("🟡 No eligible IE articles");
      return;
    }

    console.log("🆕 IE news detected:", selected.title);

    let tweetBody;

    try {
      tweetBody = await generateIENewsTweet(selected.title);
      if (!tweetBody || tweetBody.length < 30) {
        throw new Error("AI output invalid");
      }
    } catch {
      tweetBody = generateIEFallbackTweet(selected);
    }

    const cleanUrl = normalizeIELink(selected.link);

    const tweetText = `${tweetBody}

Indian Express 🔗 ${cleanUrl}`;
    console.log("tweetText::", tweetText);

    // await postTweet_ie_web({ text: tweetText });

    STATE.ie.seen[cleanUrl] = Date.now();
    STATE.ie.lastLink = cleanUrl;
    STATE.ie.lastTitle = selected.title;
    STATE.ie.visibleDate = new Date(getPubDate(selected)).toUTCString();

    await saveState(STATE);

    console.log("🟢 IE state saved");
  } catch (err) {
    console.error("❌ ERROR in IE polling:", err);
  }
}

function getPubDate(item) {
  return item?.pubDate ? new Date(item.pubDate).getTime() : 0;
}
