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

  // Match format
  let fmt = "";
  const format = (match?.format || "").toUpperCase();

  if (format.includes("T20")) fmt = "#T20I";
  else if (format.includes("ODI")) fmt = "#ODI";
  else if (format.includes("TEST")) fmt = "#Test";

  const blacklist = ["PSL", "BPL", "LPL", "KPL", "NCL"];

  const safeTags = [h1, h2, fmt].filter(Boolean);

  return safeTags
    .filter((tag) => !blacklist.some((x) => tag.toUpperCase().includes(x)))
    .join(" ");
}

export function buildTemplateTweet({ match, innings, event }) {
  if (!event?.type) return null;

  globalThis.TWEET_COUNTER = (globalThis.TWEET_COUNTER || 0) + 1;
  const SHOULD_ADD_HEADER = globalThis.TWEET_COUNTER % 5 === 0;

  const team = innings?.batteamname || "";
  const opponent =
    team.toLowerCase() === match.team1.toLowerCase()
      ? match.team2
      : match.team1;

  const isPakInvolved =
    team.toLowerCase().includes("pakistan") ||
    opponent.toLowerCase().includes("pakistan");

  const emojiPack = getEmojiPack(team, opponent);

  const universalHeader = TEMPLATES.HEADERS[
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

  if (isPakInvolved) {
    const safeNeutralEmoji = ["🔹", "⚡", "📛", "🎯", "💠"];
    const PAK_EMOJI =
      safeNeutralEmoji[Math.floor(Math.random() * safeNeutralEmoji.length)];

    const pakHeaders = [
      "🚨 {MATCH} Live 🚨",
      "📢 {MATCH} Update 📢",
      "🔥 {MATCH} Moment 🔥",
    ];

    const pakHeader = pakHeaders[
      Math.floor(Math.random() * pakHeaders.length)
    ].replace("{MATCH}", `${match.team1Short} vs ${match.team2Short}`);

    if (event.type === "SIX" || event.type === "FOUR") {
      text = `{BATTER} hits a ${event.type} ${PAK_EMOJI}`.replace(
        "{BATTER}",
        event.batterName || innings?.batsman?.[0]?.name || "Batter"
      );
    } else if (event.type === "WICKET") {
      text = `{BATTER} is out. ${PAK_EMOJI}`.replace(
        "{BATTER}",
        event.batterName || "Batter"
      );
    } else if (event.type === "BATSMAN_MILESTONE") {
      text = `{BATTER} reaches {RUNS}* ({BALLS}). ${PAK_EMOJI}`
        .replace("{BATTER}", event.batterName)
        .replace("{RUNS}", event.runs)
        .replace("{BALLS}", event.balls);
    } else if (event.type === "PARTNERSHIP_MILESTONE") {
      text = `Partnership reaches {RUNS}. ${PAK_EMOJI}`.replace(
        "{RUNS}",
        event.totalRuns
      );
    } else if (event.type === "TEAM_MILESTONE") {
      text = `Team total reaches {RUNS}. ${PAK_EMOJI}`.replace(
        "{RUNS}",
        innings.runs
      );
    }

    const scoreLine = `${innings.batteamsname} - ${innings.runs}/${innings.wickets} (${innings.overs} Overs)`;
    const hashtags = buildHashtags(match, match.team1Short, match.team2Short);

    let out = "";
    if (SHOULD_ADD_HEADER) out += `${pakHeader}\n\n`;

    out += `${text}\n\n${scoreLine}\n\n${match.status}\n\n${hashtags}`;
    return out.trim();
  }

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
  // SCORELINE & FINAL OUTPUT
  // ==========================================================
  const scoreLine = `${innings.batteamsname} - ${innings.runs}/${innings.wickets} (${innings.overs} Overs)`;
  const hashtags = buildHashtags(match, match.team1Short, match.team2Short);

  let finalOut = "";
  if (SHOULD_ADD_HEADER) finalOut += `${universalHeader}\n\n`;

  finalOut += `${eventHeader}\n${text}\n\n${scoreLine}\n\n${match.status}\n\n${hashtags}`;

  return finalOut.trim();
}
