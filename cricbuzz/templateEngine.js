//templateEngine.js

import { generatePrediction } from "./ai/aiPrediction.js";
import { generateStatusTone } from "./ai/aiStatusTone.js";
import {
  TEMPLATES,
  buildMatchResultTemplate,
  getEmojiPack,
} from "./templates.js";

function buildHashtags(match, team1Short, team2Short) {
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

export async function buildTemplateTweet({ match, innings, event }) {
  if (event.type === "TOSS") {
    const { tossText } = event;

    const hashtags = buildHashtags(match, match.team1Short, match.team2Short);

    return `🪙 Toss Update
  
  ${tossText}
  
  ${hashtags}`;
  }

  if (event.type === "MATCH_RESULT") {
    return buildMatchResultTemplate(match, event.resultText);
  }
  if (!event?.type) return null;

  globalThis.TWEET_COUNTER = (globalThis.TWEET_COUNTER || 0) + 1;
  // const SHOULD_ADD_HEADER = globalThis.TWEET_COUNTER % 5 === 0;
  const SHOULD_ADD_HEADER = true;

  const team = innings?.batteamname || "";
  const opponent =
    team.toLowerCase() === match.team1.toLowerCase()
      ? match.team2
      : match.team1;

  const isPakInvolved =
    team.toLowerCase().includes("pakistan") ||
    opponent.toLowerCase().includes("pakistan");

  // const isOpponentBatting = !team.toLowerCase().includes("india");
  const isIndiaBatting = team.toLowerCase().includes("india");

  const emojiPack = getEmojiPack(team, opponent);

  const universalHeader = TEMPLATES.HEADERS[
    Math.floor(Math.random() * TEMPLATES.HEADERS.length)
  ].replace("{MATCH}", `${match.team1Short} vs ${match.team2Short}`);

  const eventHeaders = TEMPLATES.EVENT_HEADERS[event.type] || [];
  const eventHeader =
    eventHeaders[Math.floor(Math.random() * eventHeaders.length)];

  const bodies = !isIndiaBatting
    ? TEMPLATES.BODIES_OPPONENT[event.type]
    : TEMPLATES.BODIES[event.type];

  if (!bodies) {
    const scoreLine = `${innings.batteamsname} - ${innings.runs}/${innings.wickets} (${innings.overs} Overs)`;
    const hashtags = buildHashtags(match, match.team1Short, match.team2Short);

    const fallbackOptions = [
      `${scoreLine}\n\n${match.status}\n\n${hashtags}`,
      `Score Update:\n${scoreLine}\n\n${match.status}\n\n${hashtags}`,
      `${scoreLine}\n\n${hashtags}`,
    ];

    return fallbackOptions[Math.floor(Math.random() * fallbackOptions.length)];
  }

  const body = bodies[Math.floor(Math.random() * bodies.length)];

  const EMOJI =
    event.type === "WICKET"
      ? emojiPack.wicket[Math.floor(Math.random() * emojiPack.wicket.length)]
      : event.type === "SIX" || event.type === "FOUR"
      ? emojiPack.hit[Math.floor(Math.random() * emojiPack.hit.length)]
      : emojiPack.hit[Math.floor(Math.random() * emojiPack.hit.length)];

  // const EMOJI = "";

  let text = "";

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

  // else if (event.type === "BOWLER_MILESTONE") {
  //   text = body
  //     .replace("{BOWLER}", event.bowlerName)
  //     .replace("{WICKETS}", event.wickets)
  //     .replace("{RUNS}", event.runs)
  //     .replace("{OVERS}", event.overs)
  //     .replace("{EMOJI}", EMOJI);
  // }

  const baseScoreLine = `${innings.batteamsname} - ${innings.runs}/${innings.wickets} (${innings.overs} Overs)`;

  const targetLine = innings.targetInning?.battingTeamName
    ? `${innings.targetInning.battingTeamName} - ${innings.targetInning.targetRuns}/${innings.targetInning.targetWicket} (${innings.targetInning.targetOvers})`
    : "";
  let targetLineShort = "";
  if (event.type === "WICKET" && innings.targetInning?.targetRuns) {
    targetLineShort = `Target (${innings.targetInning.battingTeamShortName}): ${innings.targetInning.targetRuns}`;
  }

  // Easy helper to include target only when it exists
  const maybeTarget = targetLineShort ? `${targetLineShort}\n\n` : "\n";

  const scoreLine = `${baseScoreLine}`;

  // const hashtags = buildHashtags(match, match.team1Short, match.team2Short);
  const hashtags = buildHashtags(match, match.team1Short, match.team2Short);

  text = isIndiaBatting ? text.toUpperCase() : text;

  const variations = [
    `${universalHeader}\n\n${text}\n\n${scoreLine}\n${maybeTarget}${match.status}\n\n${hashtags}`,

    `${universalHeader}\n\n${text}\n\n${scoreLine}\n${maybeTarget}${hashtags}`,

    `${universalHeader}\n\n${text}\n\n${scoreLine}\n${maybeTarget}${hashtags}`,

    `${universalHeader}\n\n${text}\n\n${match.status}\n\n${hashtags}`,

    `${universalHeader}\n\n${scoreLine}\n${maybeTarget}${match.status}\n\n${hashtags}`,

    `${universalHeader}\n\n${scoreLine}\n${maybeTarget}${match.status}\n\n${hashtags}`,
  ];

  const finalOut = variations[Math.floor(Math.random() * variations.length)];
  return finalOut.trim();
}
