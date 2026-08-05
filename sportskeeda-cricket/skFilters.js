// sportskeeda-cricket/skFilters.js

const SPORTSKEEDA_HOSTS = new Set(["sportskeeda.com", "www.sportskeeda.com"]);

export function isSportskeedaCricketArticle(item) {
  const link = item?.link || item?.url;
  if (!link) return false;

  try {
    const url = new URL(link);
    return (
      SPORTSKEEDA_HOSTS.has(url.hostname.toLowerCase()) &&
      url.pathname.startsWith("/cricket/") &&
      !isNonArticlePath(url.pathname)
    );
  } catch {
    return false;
  }
}

export function normalizeSKLink(link = "") {
  try {
    const url = new URL(link, "https://www.sportskeeda.com");
    url.search = "";
    url.hash = "";
    url.hostname = "www.sportskeeda.com";
    return url.toString().replace(/\/$/, "");
  } catch {
    return link.split("?")[0].split("#")[0].replace(/\/$/, "");
  }
}

export function normalizeSKTitle(title = "") {
  return title
    .toLowerCase()
    .replace(/&(?:#8217|#038|amp);/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isNonArticlePath(pathname = "") {
  return [
    "/cricket",
    "/cricket/",
    "/cricket/schedule",
    "/cricket/live-cricket-score",
    "/cricket/cricket-schedule",
    "/cricket/points-table",
    "/cricket/rankings",
    "/cricket/teams",
    "/cricket/players",
  ].some((path) => pathname === path || pathname.startsWith(`${path}/`));
}
