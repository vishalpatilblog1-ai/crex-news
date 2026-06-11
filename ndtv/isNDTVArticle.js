export function isNDTVArticle(item) {
  const link = item?.link || "";
  return link.includes("ndtv.com/cricket/");
}

export function isNDTVFootballArticle(item) {
  const link = item?.link || "";
  return link.includes("ndtv.com/football/");
}

export function normalizeNDTVLink(link) {
  return link?.split("?")[0]?.split("#")[0]?.replace(/\/$/, "");
}
export function normalizeNDTVFootballLink(link) {
  return link?.split("?")[0]?.split("#")[0]?.replace(/\/$/, "");
}

export function normalizeNDTVTitle(title) {
  return title
    ?.toLowerCase()
    ?.replace(/&#8217;|&#038;/g, "")
    ?.replace(/[^a-z0-9 ]/g, "")
    ?.replace(/\s+/g, " ")
    ?.trim();
}

export function normalizeNDTVFootballTitle(title) {
  return title
    ?.toLowerCase()
    ?.replace(/&#8217;|&#038;/g, "")
    ?.replace(/[^a-z0-9 ]/g, "")
    ?.replace(/\s+/g, " ")
    ?.trim();
}
