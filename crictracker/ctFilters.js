// cricket-addictor/ctFilters.js

export function isCTArticle(item) {
  return item?.link && item.link.includes("crictracker.com/cricket-news/");
}

export function normalizeCTLink(link) {
  return link.split("?")[0].split("#")[0].replace(/\/$/, "");
}

export function normalizeCTTitle(title) {
  return title
    .toLowerCase()
    .replace(/&#8217;|&#038;|&amp;/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
