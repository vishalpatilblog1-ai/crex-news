//tweetValidators.js

export function headlineValidator(team1Short, team2Short, format) {
  const team1 = team1Short && team1Short !== "null" ? team1Short : "";
  const team2 = team2Short && team2Short !== "null" ? team2Short : "";
  const fmt = format && format !== "null" ? format : "";

  if (team1 && team2 && fmt) {
    return `🚨 ${team1} vs ${team2} ${fmt} UPDATES 🚨`;
  }

  return `🚨 MATCH UPDATES 🚨`;
}

export function buildHashtags(match, team1Short, team2Short) {
  if (!team1Short || !team2Short) return "";

  const h1 = `#${team1Short}vs${team2Short}`;
  const h2 = `#${team1Short}v${team2Short}`;

  let fmt = "";
  const format = (match?.format || "").toUpperCase();

  if (format.includes("T20")) fmt = "#T20I";
  else if (format.includes("ODI") || format.includes("ONE")) fmt = "#ODI";
  else if (format.includes("TEST")) fmt = "#Test";

  const blacklist = ["PSL", "BPL", "LPL", "KPL", "NCL"];

  return [h1, h2, fmt]
    .filter(Boolean)
    .filter((tag) => !blacklist.some((x) => tag.toUpperCase().includes(x)))
    .join(" ");
}

export function safeLine(line) {
  return line && typeof line === "string" && line.trim() !== "" ? line : "";
}
