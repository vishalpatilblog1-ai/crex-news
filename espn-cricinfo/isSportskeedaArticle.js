// sportskeeda/isSportskeedaArticle.js

// export function isSportskeedaArticle(item) {
//   if (!item) return false;

//   const link = item.link || item.url || "";

//   // Hard filter: ONLY cricket
//   if (!link.includes("/cricket/")) return false;

//   // Basic sanity checks
//   if (!item.title || !item.pubDate) return false;

//   return true;
// }

export function isSportskeedaArticle(item) {
  if (!item) return false;

  const link = (item.link || item.url || "").trim();
  if (!link.includes("sportskeeda.com/")) return false;

  if (!item.title || !item.pubDate) return false;

  // category can be string or array depending on rss parser
  const categories = []
    .concat(item.category || [])
    .map((c) => String(c).trim().toLowerCase());

  const isCricketCategory = categories.includes("cricket");
  const isCricketPath = /sportskeeda\.com\/cricket\//i.test(link);

  // cricket-only gate
  if (!isCricketCategory && !isCricketPath) return false;

  return true;
}
