// cricket-addictor/caFilters.js

export function isCAArticle(item) {
  return item?.link && item.link.includes("cricketaddictor.com/cricket-news/");
}

export function normalizeCALink(link) {
  return link.split("?")[0].split("#")[0].replace(/\/$/, "");
}

export function normalizeCATitle(title) {
  return title
    .toLowerCase()
    .replace(/&#8217;|&#038;|&amp;/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
