// sportskeeda/sportskeedaFilters.js

export function isBlockedSportskeedaHeadline(title = "") {
  const t = title.toLowerCase();

  return (
    t.includes("prediction") ||
    t.includes("betting") ||
    t.includes("fantasy") ||
    t.includes("dream11") ||
    t.includes("odds")
  );
}
