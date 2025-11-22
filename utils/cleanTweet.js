// utils/cleanTweet.js

// List of emojis / text you don't want
const BLOCKED_TOKENS = [
  "🇵🇰",
  "🇱🇰",
  "🇧🇩",
  "🇦🇫",
  "🇳🇵",
  "🇦🇺",
  "🇬🇧",
  "🇿🇦",
  "🇳🇿",
  "🇵🇭",
  "🇱🇾",
  // add more if needed
];

export function cleanTweet(text) {
  if (!text) return "";

  let cleaned = text;

  // Remove blocked emojis/text
  for (const token of BLOCKED_TOKENS) {
    cleaned = cleaned.split(token).join("");
  }

  // Remove double spaces created after stripping
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  return cleaned;
}
