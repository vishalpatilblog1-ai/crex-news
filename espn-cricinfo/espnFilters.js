// espn-cricinfo/espnFilters.js

export function isESPNArticle(item) {
  if (!item?.title || !item?.url) return false;

  // hard safety: ensure cricket URL
  return item.url.includes("/story/");
}

export function normalizeESPNLink(link) {
  if (!link) return null;

  // remove tracking params if any
  try {
    const u = new URL(link);
    return `${u.origin}${u.pathname}`;
  } catch {
    return link.split("?")[0];
  }
}
