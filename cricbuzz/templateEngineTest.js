import { getFlagEmoji } from "./templates.js";
import {
  normalizeTeamShort,
  safeLine,
  headlineValidator,
} from "./tweet-validators/tweetValidators.js";
import { generateCommentaryTweet } from "./ai/aiCommentaryTweet.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("prod");
function cleanEventLog(event) {
  if (!event) return event;

  const { batsman, bowler, ...rest } = event;
  return rest;
}
export async function buildTestTemplateTweet(matchContext) {
  const { match, event } = matchContext;
  log("TEST buildLOITemplateTweet::", cleanEventLog(event));
  log("TEST buildLOITemplateTweet::", match);
  //   console.log("matchContext::", matchContext);
  //   console.log("TEST buildLOITemplateTweet::", cleanEventLog(event));
  //   console.log("TEST buildLOITemplateTweet::", match);

  if (!match || !event) return null;

  const team1Short = match.team1Short;
  const team2Short = match.team2Short;
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

  const firstFlag = getFlagEmoji(event.batteamsname);
  const secondFlag = getFlagEmoji(event.targetInning?.battingTeamShortName);

  const firstLine = `${firstFlag ? firstFlag + " " : ""}${normalizeTeamShort(
    event.batteamsname
  )} - ${event.runs}/${event.wickets} (${event.overs} Overs)`;

  const inningsLabel = getTestInningsLabel(event);
  const secondLine = `${secondFlag ? secondFlag + " " : ""}${normalizeTeamShort(
    event.targetInning?.battingTeamShortName
  )} - ${event.targetInning?.targetRuns} Runs - ${inningsLabel}`;

  const scoreBlock = `${firstLine}\n${secondLine}`;
  // const statusLine = match.status;
  let statusLine = event?.scoreCardStatus;

  let finalTweet = `${universalHeader}\n\n`;

  if (commentary) finalTweet += `${commentary}\n\n`;
  finalTweet += `${scoreBlock}\n\n`;
  finalTweet += `${statusLine}\n\n`;

  return finalTweet.trim();
}

// Helper to derive Test innings label
export function getTestInningsLabel(event) {
  // If Cricbuzz provides inningsId
  const id = event.targetInning?.inningsId;
  if (id) return `${ordinal(id)} innings`;

  // derive fallback
  if (event.inningsid === 2) return "1st innings";
  if (event.inningsid === 3) return "2nd innings";
  if (event.inningsid === 4) return "3rd innings";
  return "1st innings";
}

function ordinal(n) {
  return (
    n +
    ["th", "st", "nd", "rd"][
      n % 10 > 3 || Math.floor((n % 100) / 10) === 1 ? 0 : n % 10
    ]
  );
}
