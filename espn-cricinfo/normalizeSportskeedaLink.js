// sportskeeda/normalizeSportskeedaLink.js

export function normalizeSportskeedaLink(url = "") {
  if (!url) return null;

  try {
    const u = new URL(url);
    u.search = ""; // remove tracking params
    u.hash = "";
    return u.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}
