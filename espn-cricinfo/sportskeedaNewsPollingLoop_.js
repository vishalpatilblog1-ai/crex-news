// sportskeeda/sportskeedaNewsPollingLoop.js

import { fetchSportskeedaRss } from "./fetchSportskeedaRss.js";

// import { parseSportskeedaArticle } from "./parseSportskeedaArticle.js";

import { generateGeminiTweet } from "../ai/generate-gemini-tweet.js";
import { generateGPTTweet } from "../ai/generate-gpt-tweet.js";

import { enqueueTweet } from "../twitter/tweetQueue.js";
import { saveState } from "../utils/stateStoreCloud.js";
import { isSportskeedaArticle } from "./isSportskeedaArticle.js";
import { normalizeSportskeedaLink } from "./normalizeSportskeedaLink.js";
import { parseSportskeedaArticle } from "./parseSportskeedaArticle.js";

export async function sportskeedaNewsPollingLoop() {
  console.log("🟢 sportskeedaNewsPollingLoop started");

  if (!global.STATE) return false;
  const STATE = global.STATE;

  /* ---------------- init state ---------------- */
  STATE.sportskeeda ??= {};
  STATE.sportskeeda.seen ??= {};

  /* ---------------- config ---------------- */
  const MAX_AGE_MIN = 180; // 3 hours
  const items = await fetchSportskeedaRss();
  if (!Array.isArray(items) || items.length === 0) return false;

  /* ---------------- select ONE article ---------------- */
  let selected = null;

  for (const item of items) {
    if (!isSportskeedaArticle(item)) continue;

    const pubMs = item.pubDate ? new Date(item.pubDate).getTime() : 0;
    if (!pubMs) continue;

    const ageMin = (Date.now() - pubMs) / 60000;
    if (ageMin > MAX_AGE_MIN) continue;

    const cleanUrl = normalizeSportskeedaLink(item.link);
    if (!cleanUrl) continue;

    if (STATE.sportskeeda.seen[cleanUrl]) continue;

    selected = item;
    break; // 🔑 pick first valid article only
  }

  if (!selected) return false;

  console.log("📰 Selected Sportskeeda item:", selected);

  const cleanUrl = normalizeSportskeedaLink(selected.link);

  /* ---------------- parse FULL HTML article ---------------- */
  let parsed;
  try {
    parsed = await parseSportskeedaArticle({
      link: selected.link,
    });
  } catch (err) {
    console.warn("❌ Sportskeeda HTML parse failed:", err?.message || err);
  }

  console.log("parsed:::", parsed);

  if (!parsed?.headline || !parsed?.body || parsed.body.length < 120) {
    STATE.sportskeeda.seen[cleanUrl] = Date.now();
    await saveState(STATE);
    return false;
  }

  const aiInput = `${parsed.headline}\n${parsed.body}`;

  /* ---------------- generate tweet ---------------- */
  let tweetText = null;

  try {
    tweetText = await generateGeminiTweet(aiInput);
  } catch (err) {
    console.warn("⚠️ Gemini failed:", err?.message || err);
  }

  if (!tweetText) {
    try {
      tweetText = await generateGPTTweet(aiInput);
    } catch (err) {
      console.warn("❌ GPT failed:", err?.message || err);
    }
  }

  if (!tweetText || tweetText.length < 30) {
    STATE.sportskeeda.seen[cleanUrl] = Date.now();
    await saveState(STATE);
    return false;
  }

  /* ---------------- enqueue tweet ---------------- */
  const imageUrl = selected["media:thumbnail"]?.url || parsed.imageUrl || null;

  enqueueTweet({
    id: `SPORTSKEEDA:${cleanUrl}`,
    source: "SPORTSKEEDA",
    text: tweetText,
    imageUrl,
    seenKey: cleanUrl,
  });

  STATE.sportskeeda.seen[cleanUrl] = Date.now();
  await saveState(STATE);

  console.log("📥 Queued Sportskeeda article:", parsed.headline);
  return true;
}
