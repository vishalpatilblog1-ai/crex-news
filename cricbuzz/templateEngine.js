//templateEngine.js

import { generateCommentaryTweet } from "./ai/aiCommentaryTweet.js";
import { buildMatchResultTemplate, getFlagEmoji } from "./templates.js";
import {
  buildHashtags,
  headlineValidator,
  safeLine,
} from "./tweet-validators/tweetValidators.js";

export async function buildTemplateTweet(matchContext) {
  const { match, innings, event } = matchContext;

  const eventType = matchContext?.event?.type;
  const rawCommentary = matchContext?.event?.commentaryTexts?.[0];
  const isSecondInningRunning = innings?.inningsid === 2;
  // console.log("isSecondInningRunning:::", isSecondInningRunning);

  const team1Short = matchContext?.match?.team1Short || "";
  const team2Short = matchContext?.match?.team2Short || "";
  const format = (match?.format || "").toUpperCase() || "";

  const universalHeader = headlineValidator(team1Short, team2Short, format);

  const battingTeamShort = matchContext?.innings?.batteamsname;

  if (!match || !event) return null;

  if (event.type === "TOSS") {
    const tossWinner = event.tossWinner;

    const tossDecision = event.tossDecision;

    if (
      !tossWinner ||
      tossWinner.trim() === "" ||
      !tossDecision ||
      tossDecision.trim() === ""
    ) {
      return "SKIP";
    }

    const tossText =
      event.tossText ||
      `${tossWinner} won the toss and chose to ${tossDecision}`;

    const hashtags = buildHashtags(match, match.team1Short, match.team2Short);

    return `🪙 Toss Update
  
  ${tossText}
  
  ${hashtags}`;
  }

  if (event.type === "MATCH_RESULT") {
    const output = buildMatchResultTemplate(match, event.resultText);

    if (!output || typeof output !== "string") {
      return `🏆 Match Result\n\n${event.resultText}\n\n#${match.team1Short}vs${match.team2Short}`;
    }

    return output;
  }
  if (!event?.type) return null;

  globalThis.TWEET_COUNTER = (globalThis.TWEET_COUNTER || 0) + 1;

  const team = innings?.batteamname || "";

  let targetLineShort = "";
  if (event.type === "WICKET" && innings.targetInning?.targetRuns) {
    targetLineShort = `Target (${innings.targetInning.battingTeamShortName}): ${innings.targetInning.targetRuns}`;
  }

  const firstInningFlag = getFlagEmoji(innings.batteamsname);
  const secondInningFlag = getFlagEmoji(
    innings.targetInning?.battingTeamShortName
  );

  const firstLine = `${firstInningFlag ? firstInningFlag + " " : ""}${
    innings.batteamsname
  } - ${innings.runs}/${innings.wickets} (${innings.overs} Overs)`;

  const secondLine = innings.targetInning
    ? `${secondInningFlag ? secondInningFlag + " " : ""}${
        innings.targetInning.battingTeamShortName
      } - ${innings.targetInning?.targetRuns} Runs (Target)`
    : "";

  const baseScoreLine = secondLine
    ? `${firstLine} \n${secondLine} `
    : firstLine;

  const maybeTarget = targetLineShort ? `${targetLineShort}\n\n` : "\n";
  let finalTweet = `${universalHeader}\n\n`;
  const commentaryTexts = await generateCommentaryTweet(
    eventType,
    rawCommentary,
    team1Short,
    team2Short,
    battingTeamShort
  );
  const commentary = commentaryTexts?.trim() ? commentaryTexts.trim() : "";

  const scoreLine = `${baseScoreLine}`;

  const safeStatus = isSecondInningRunning && safeLine(match.status);
  const safeScore = safeLine(scoreLine);
  if (commentary) {
    finalTweet += `${commentary}\n\n`;
  }

  if (safeScore) {
    finalTweet += `${safeScore}\n\n`;
  }
  if (safeStatus) finalTweet += `${safeStatus}\n\n`;

  const hashtags = buildHashtags(match, match.team1Short, match.team2Short);

  finalTweet += `${hashtags}`;

  return finalTweet.trim();
}
