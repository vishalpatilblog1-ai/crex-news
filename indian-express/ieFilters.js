export function isIEArticle(item) {
  return (
    item.link && item.link.includes("indianexpress.com/article/sports/cricket/")
  );
}

export function normalizeIELink(link) {
  return link.split("?")[0].split("#")[0].replace(/\/$/, "");
}

export function normalizeIETitle(title) {
  return title
    .toLowerCase()
    .replace(/&#8217;|&#038;/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
