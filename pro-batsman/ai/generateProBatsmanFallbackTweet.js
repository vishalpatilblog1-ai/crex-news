// ai/generateProBatsmanFallbackTweet.js

export function generateProBatsmanFallbackTweet(item) {
  if (!item) return "Cricket news update.";

  const title = cleanText(item.title);
  const categories = normalizeCategories(item.category);

  // Try to add light context without opinion
  let contextLine = "";

  if (categories.includes("Indian Premier League")) {
    contextLine = "IPL update.";
  } else if (categories.includes("India")) {
    contextLine = "India cricket update.";
  } else if (categories.includes("Cricket News")) {
    contextLine = "Cricket news update.";
  }

  // Construct tweet
  if (title && contextLine) {
    return `${title}\n${contextLine}`;
  }

  if (title) return title;

  return "Cricket news update.";
}

// ---------- helpers ----------

function cleanText(text) {
  if (!text || typeof text !== "string") return "";

  return text
    .replace(/\s+/g, " ")
    .replace(/\|.*/g, "") // remove trailing site branding
    .trim();
}

function normalizeCategories(category) {
  if (!category) return [];

  if (Array.isArray(category)) return category.map(String);

  return [String(category)];
}
