// probatsmanFilters.js
export function isProBatsmanArticle(item) {
  if (!item?.link) return false;

  // Skip videos / watch-only articles
  if (item.title?.toLowerCase().includes("watch")) return false;

  return true;
}

export function normalizeProBatsmanLink(link) {
  if (!link) return "";
  return link.split("?")[0].split("#")[0];
}
