// bbcFilters.js
export function isBBCArticle(item) {
  return item.link && item.link.includes("/sport/cricket/articles/");
}

export function cleanBBCUrl(url) {
  return url.split("?")[0];
}

export function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
