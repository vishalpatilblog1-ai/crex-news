import { generateCommentaryTweet } from "./ai/aiCommentaryTweet.js";
import { splitCommentary } from "./match-events/tossAndResultHandler.js";
import { bold, getFlagEmoji } from "./templates.js";
import {
  buildHashtags,
  headlineValidator,
  normalizeTeamShort,
} from "./tweet-validators/tweetValidators.js";

function ordinal(n) {
  return ["1st", "2nd", "3rd"][n - 1] || `${n}th`;
}

export function getTestInningsDisplay(scorecard, currentInningsId) {
  if (!Array.isArray(scorecard)) return [];

  // Sort by inningsid ascending (1 → 4)
  const sorted = [...scorecard].sort((a, b) => a.inningsid - b.inningsid);

  const teamInningsCount = {}; // Track 1st/2nd/3rd innings for each team
  const display = [];

  for (const inn of sorted) {
    const team = normalizeTeamShort(inn.batteamsname);
    const flag = getFlagEmoji(inn.batteamsname);

    // Count how many times this team batted
    if (!teamInningsCount[team]) teamInningsCount[team] = 1;
    else teamInningsCount[team]++;

    const inningsNumber = teamInningsCount[team];

    // Build label: 1st inns / 2nd inns + declared + follow-on
    const labelParts = [];
    labelParts.push(`${ordinal(inningsNumber)} inns`);

    if (inn.isdeclared) labelParts.push("declared");
    if (inn.isfollowon) labelParts.push("follow-on");

    const labelText = labelParts.join(", ");

    // Score formatting
    const scoreVal =
      inn.wickets != null ? `${inn.score}/${inn.wickets}` : `${inn.score}`;

    // const overs = inn.overs ? `(${inn.overs} Overs)` : "";
    const overs = inn.overs ? `(${inn.overs})` : "";

    // ❗ DO NOT show innings label for current innings
    const labelSection =
      inn.inningsid === currentInningsId ? "" : ` (${labelText})`;

    const line = `${
      flag ? flag + "\u00A0\u00A0" : ""
    }${team} – ${scoreVal} ${overs}${labelSection}`.trim();

    display.push({
      inningsid: inn.inningsid,
      isCurrent: inn.inningsid === currentInningsId,
      text: bold(line),
    });
  }

  // Reverse order → current inning first
  display.sort((a, b) => b.inningsid - a.inningsid);

  const active = display.find((d) => d.isCurrent);
  const others = display.filter((d) => !d.isCurrent);

  // Return as array of lines
  return [active ? active.text : "", ...others.map((o) => o.text)].filter(
    Boolean
  );
}

export async function buildTestTemplateTweet(matchContext, scoreRes) {
  const { event } = matchContext;
  const { team1Short, team2Short } = event;
  console.log("buildTestTemplateTweet::::::", event);

  // if (!match || !event || !scoreRes) return null;
  if (!event || !scoreRes) return null;

  // const team1Short = match.team1Short;
  // const team2Short = match.team2Short;
  const format = "TEST";

  const universalHeader = headlineValidator(team1Short, team2Short, format);

  const rawCommentary = event.commentaryTexts?.[0] || "";
  const commentaryTexts = await generateCommentaryTweet(
    event,
    rawCommentary,
    team1Short,
    team2Short
  );
  const commentary = commentaryTexts?.trim() || "";
  const { commLine1, commLine2 } = splitCommentary(commentary);

  const scorecard = scoreRes?.scorecard || [];
  const currentInnId = event.targetInning?.inningsId || event.inningsid || null;

  const inningsLines = getTestInningsDisplay(scorecard, currentInnId);
  const scoreBlock = inningsLines.join("\n");

  // let statusLine = event?.scoreCardStatus || match.status || "";
  let statusLine = event?.scoreCardStatus || "";

  let finalTweet = `${universalHeader}\n\n`;

  // if (commentary) finalTweet += `${commentary}\n\n`;
  if (commLine1) finalTweet += bold(`${commLine1}\n`);
  if (commLine2) finalTweet += `${commLine2}\n\n`;

  finalTweet += `${scoreBlock}\n\n`;
  finalTweet += `${statusLine}\n\n`;

  // const hashtags = buildHashtags(
  //   format,
  //   team1Short,
  //   team2Short,
  //   event.batterName,
  //   event.bowlerName,
  //   event.type,
  //   event.series
  // );

  const hashtags = buildHashtags(
    format,
    team1Short,
    team2Short,
    event.batterName,
    event.bowlerName,
    event.type,
    event.series
  );

  finalTweet += hashtags;

  return finalTweet.trim();
}
