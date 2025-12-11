//tweetValidators.js

import { bold } from "../templates.js";

export function headlineValidator(team1Short, team2Short, format) {
  const team1 = normalizeTeamShort(team1Short);
  const team2 = normalizeTeamShort(team2Short);

  const fmt = format && format !== "null" ? format : "";

  if (team1 && team2 && fmt) {
    return bold(
      `🚨\u00A0\u00A0${team1} vs ${team2} ${fmt} UPDATES\u00A0\u00A0🚨`
    );
  }

  return `🚨 MATCH UPDATES 🚨`;
}

export function normalizeTeamShort(code) {
  if (!code) return code;

  const upper = code.toUpperCase().trim();

  if (upper === "RSA") return "SA";

  return upper;
}

export function buildHashtags(
  format,
  t1,
  t2,
  batsman,
  bowler,
  eventType,
  series
) {
  const team1Short = normalizeTeamShort(t1);
  const team2Short = normalizeTeamShort(t2);

  if (!team1Short || !team2Short) return "";

  const h1 = `#${team1Short}v${team2Short}`;
  const h2 = `#${team2Short}v${team1Short}`;

  let fmt = "";
  // const format = (match?.format || "").toUpperCase();

  if (format.includes("T20")) fmt = "#T20I";
  else if (format.includes("ODI")) fmt = "#ODI";
  else if (format.includes("TEST")) fmt = "#Test";

  const playerTags = new Set();

  const makeTag = (name) => "#" + name.replace(/[^a-zA-Z]/g, "").trim();

  if (batsman && typeof batsman === "string") {
    playerTags.add(makeTag(batsman));
  }

  if (eventType === "WICKET" && bowler && typeof bowler === "string") {
    playerTags.add(makeTag(bowler));
  }

  let ashesTag = "";
  const seriesName = series?.toLowerCase();
  if (seriesName && seriesName.includes("ashes")) {
    ashesTag = "#Ashes";
  }

  const blacklist = ["PSL", "BPL", "LPL", "KPL", "NCL"];

  return [
    "#CricketTwitter",
    "#IndianCricket",
    h1,
    h2,
    // fmt,
    ashesTag,
    ...Array.from(playerTags),
  ]
    .filter(Boolean)
    .filter((tag) => !blacklist.some((x) => tag.toUpperCase().includes(x)))
    .join(" ");
}

export function safeLine(line) {
  return line && typeof line === "string" && line.trim() !== "" ? line : "";
}
