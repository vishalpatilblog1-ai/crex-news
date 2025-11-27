//templateEngine
import { TEMPLATES, getEmojiPack } from "./templates.js";

// ==========================================================
// AUTO HASHTAG GENERATOR
// ==========================================================
function buildHashtags(match, team1Short, team2Short) {
  if (!team1Short || !team2Short) return "";

  // Team-vs-team tags
  const h1 = `#${team1Short}vs${team2Short}`;
  const h2 = `#${team1Short}v${team2Short}`;

  // Format tag (safe only)
  let fmt = "";
  const format = (match?.format || "").toUpperCase();

  if (format.includes("T20")) fmt = "#T20I";
  else if (format.includes("ODI")) fmt = "#ODI";
  else if (format.includes("TEST")) fmt = "#Test";

  // ❌ Blacklist any league-related tags
  const blacklist = [
    "PSL", // Pakistan Super League
    "BPL", // Bangladesh Premier League
    "LPL", // Lanka Premier League
    "KPL", // Kashmir Premier League
    "NCL", // Pakistan domestic
  ];

  const safeTags = [h1, h2, fmt].filter(Boolean);

  // Final filter to make 200% sure
  return safeTags
    .filter((tag) => !blacklist.some((x) => tag.toUpperCase().includes(x)))
    .join(" ");
}

// ==========================================================
// TEMPLATE BUILDER FOR EVENTS
// ==========================================================
export function buildTemplateTweet({ match, innings, event }) {
  if (!event?.type) return null;

  const team = innings?.batteamname || "";
  const opponent =
    team.toLowerCase() === match.team1.toLowerCase()
      ? match.team2
      : match.team1;

  const emojiPack = getEmojiPack(team, opponent);

  const header = TEMPLATES.HEADERS[
    Math.floor(Math.random() * TEMPLATES.HEADERS.length)
  ].replace("{MATCH}", `${match.team1Short} vs ${match.team2Short}`);

  const eventHeaders = TEMPLATES.EVENT_HEADERS[event.type] || [];
  const eventHeader =
    eventHeaders[Math.floor(Math.random() * eventHeaders.length)];

  const bodies = TEMPLATES.BODIES[event.type];
  if (!bodies) return null;

  const body = bodies[Math.floor(Math.random() * bodies.length)];

  const EMOJI =
    event.type === "WICKET"
      ? emojiPack.wicket[Math.floor(Math.random() * emojiPack.wicket.length)]
      : event.type === "SIX" || event.type === "FOUR"
      ? emojiPack.hit[Math.floor(Math.random() * emojiPack.hit.length)]
      : emojiPack.neutral[Math.floor(Math.random() * emojiPack.neutral.length)];

  let text = "";

  // ==========================================================
  // RENDER TEMPLATE BASED ON EVENT TYPE
  // ==========================================================

  if (event.type === "SIX" || event.type === "FOUR") {
    text = body
      .replace(
        "{BATTER}",
        event.batterName || innings?.batsman?.[0]?.name || "Batter"
      )
      .replace("{EMOJI}", EMOJI);
  } else if (event.type === "WICKET") {
    text = body
      .replace("{BATTER}", event.batterName || "Batter")
      .replace(
        "{BOWLER}",
        event.bowlerName || innings?.bowler?.[0]?.name || "Bowler"
      )
      .replace("{EMOJI}", EMOJI);
  } else if (event.type === "BATSMAN_MILESTONE") {
    text = body
      .replace("{BATTER}", event.batterName)
      .replace("{RUNS}", event.runs)
      .replace("{BALLS}", event.balls)
      .replace("{EMOJI}", EMOJI);
  } else if (event.type === "PARTNERSHIP_MILESTONE") {
    text = body
      .replace("{RUNS}", event.totalRuns)
      .replace("{BAT1}", event.bat1?.name || "")
      .replace("{BAT2}", event.bat2?.name || "")
      .replace("{EMOJI}", EMOJI);
  } else if (event.type === "TEAM_MILESTONE") {
    text = body.replace("{RUNS}", innings.runs).replace("{EMOJI}", EMOJI);
  }

  // ==========================================================
  // SCORELINE
  // ==========================================================
  const scoreLine = `${innings.batteamsname} - ${innings.runs}/${innings.wickets} (${innings.overs} Overs)`;

  const hashtags = buildHashtags(match, match.team1Short, match.team2Short);

  // ==========================================================
  // FINAL TWEET
  // ==========================================================
  return `
${header}

${eventHeader}
${text}

${scoreLine}

${match.status}

${hashtags}
  `.trim();
}
