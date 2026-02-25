import { extractTextFromImage } from "./ocrImage.js";

export async function isRiskyTwitterImage(imagePath) {
  const text = (await extractTextFromImage(imagePath)).toLowerCase();

  const hasHandle = /@\w+/.test(text);

  const twitterKeywords = [
    "reply",
    "retweet",
    "likes",
    "quote",
    "followers",
    "following",
  ];

  const hasTwitterUI = twitterKeywords.some((word) => text.includes(word));

  if (hasHandle || hasTwitterUI) {
    return {
      risky: true,
      reason: hasHandle ? "HANDLE_DETECTED" : "TWITTER_UI_DETECTED",
      extractedText: text,
    };
  }

  return {
    risky: false,
    reason: "CLEAN_IMAGE",
    extractedText: text,
  };
}

export async function isRiskyTwitterImageIE(imagePath) {
  const rawText = await extractTextFromImage(imagePath);
  const text = rawText.toLowerCase();

  /* ------------------ 1️⃣ Twitter Screenshot Detection ------------------ */

  const hasHandle = /@\w+/.test(text);

  const twitterKeywords = [
    "reply",
    "retweet",
    "likes",
    "quote",
    "followers",
    "following",
    "views",
  ];

  const hasTwitterUI = twitterKeywords.some((word) => text.includes(word));

  /* ------------------ 2️⃣ LIVE / Broadcast Detection ------------------ */

  const broadcastKeywords = [
    "live",
    "breaking",
    "exclusive",
    "watch",
    "subscribe",
  ];

  const hasBroadcastOverlay = broadcastKeywords.some((word) =>
    text.includes(word)
  );

  /* ------------------ 3️⃣ News Branding Detection ------------------ */

  const newsBrandKeywords = ["indian express", "express", "tv", "sports"];

  const hasNewsBranding = newsBrandKeywords.some((word) => text.includes(word));

  /* ------------------ FINAL DECISION ------------------ */

  if (hasHandle) {
    return {
      risky: true,
      reason: "HANDLE_DETECTED",
      extractedText: text,
    };
  }

  if (hasTwitterUI) {
    return {
      risky: true,
      reason: "TWITTER_UI_DETECTED",
      extractedText: text,
    };
  }

  if (hasBroadcastOverlay) {
    return {
      risky: true,
      reason: "LIVE_BROADCAST_DETECTED",
      extractedText: text,
    };
  }

  if (hasNewsBranding) {
    return {
      risky: true,
      reason: "NEWS_BRANDING_DETECTED",
      extractedText: text,
    };
  }

  return {
    risky: false,
    reason: "CLEAN_IMAGE",
    extractedText: text,
  };
}
