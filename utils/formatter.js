// formatter.js

export function shortTeamName(name = "") {
  const map = {
    india: "IND",
    "south africa": "SA",
    pakistan: "PAK",
    australia: "AUS",
    england: "ENG",
    "new zealand": "NZ",
    "sri lanka": "SL",
    bangladesh: "BAN",
    "west indies": "WI",
    afghanistan: "AFG",
    zimbabwe: "ZIM",
    ireland: "IRE",
    nepal: "NEP",
    netherlands: "NED",
    uae: "UAE",
    scotland: "SCO",
  };

  const key = name.trim().toLowerCase();
  return map[key] || name;
}

export function cleanBallText(text) {
  if (!text) return "";
  return text
    .replace(/B\d\$/g, "")
    .replace(/,,/g, ",")
    .replace(/\s+,/g, ",")
    .replace(/\s+/g, " ")
    .trim();
}
