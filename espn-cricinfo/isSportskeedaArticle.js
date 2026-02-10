// sportskeeda/isSportskeedaArticle.js

export function isSportskeedaArticle(item) {
  if (!item) return false;

  const link = item.link || item.url || "";

  // Hard filter: ONLY cricket
  if (!link.includes("/cricket/")) return false;

  // Basic sanity checks
  if (!item.title || !item.pubDate) return false;

  return true;
}
