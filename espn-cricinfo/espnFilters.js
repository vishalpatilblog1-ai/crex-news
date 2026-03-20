// espn-cricinfo/espnFilters.js

export function isESPNArticle(item) {
  if (!item?.title || !item?.link) return false;

  // hard safety: ensure cricket URL
  return item.link.includes("/story/");
}

export function normalizeESPNLink(link) {
  if (!link) return null;

  try {
    const u = new URL(link);
    return `${u.origin}${u.pathname}`;
  } catch {
    return link.split("?")[0];
  }
}
