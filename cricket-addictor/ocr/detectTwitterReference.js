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
