// hinduFilters.js

export function isHinduArticle(item) {
  if (!item?.link) return false;

  // Cricket section only
  if (!item.link.includes("/sport/cricket/")) return false;

  // Skip live blogs (optional safety)
  if (item.link.includes("/live/")) return false;

  return true;
}

export function normalizeHinduLink(link) {
  if (!link) return "";

  // Remove query params & fragments
  return link.split("?")[0].split("#")[0];
}
