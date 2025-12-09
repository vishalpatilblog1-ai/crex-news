//templateEngine.js

import { createLogger } from "../utils/logger.js";
import { generateCommentaryTweet } from "./ai/aiCommentaryTweet.js";
import { getFlagEmoji } from "./templates.js";
import { premiumTemplateSix } from "./templates/premium-template-6.js";
import {
  buildHashtags,
  headlineValidator,
  normalizeTeamShort,
  safeLine,
} from "./tweet-validators/tweetValidators.js";
// import { createLogger } from "./utils/logger.js";

function cleanEventLog(event) {
  if (!event) return event;

  const { batsman, bowler, ...rest } = event;
  return rest;
}
const log = createLogger("prod");

export async function buildLOITemplateTweet(matchContext, score = null) {
  const { match, event } = matchContext;

  log("Event buildLOITemplateTweet::", cleanEventLog(event));
  log("Match buildLOITemplateTweet::", match);

  const rawCommentary = matchContext?.event?.commentaryTexts?.[0];
  const isSecondInningRunning = event?.inningsid === 2;
  const team1Short = matchContext?.match?.team1Short || "";
  const team2Short = matchContext?.match?.team2Short || "";
  const format = (match?.format || "").toUpperCase() || "";

  const universalHeader = headlineValidator(team1Short, team2Short, format);

  if (!match || !event) return null;

  if (!event?.type) return null;

  globalThis.TWEET_COUNTER = (globalThis.TWEET_COUNTER || 0) + 1;

  let targetLineShort = "";
  if (event.type === "WICKET" && event?.targetInning?.targetRuns) {
    targetLineShort = `Target (${event.targetInning.battingTeamShortName}): ${event.targetInning.targetRuns}`;
  }

  const firstInningFlag = getFlagEmoji(event.batteamsname);
  const secondInningFlag = getFlagEmoji(
    event.targetInning?.battingTeamShortName
  );

  const firstLine = `${
    firstInningFlag ? firstInningFlag + " " : ""
  }${normalizeTeamShort(event.batteamsnameShort || event.batteamsname)} - ${
    event.runs
  }/${event.wickets} (${event.overs} Overs)`;

  let secondLine = "";

  if (isSecondInningRunning && event.targetInning) {
    if (format === "TEST") {
      secondLine = `${
        secondInningFlag ? secondInningFlag + " " : ""
      }${normalizeTeamShort(event.targetInning.battingTeamShortName)} - ${
        event.targetInning.targetRuns
      } Runs - first innings`;
    } else {
      secondLine = `${
        secondInningFlag ? secondInningFlag + " " : ""
      }${normalizeTeamShort(event.targetInning.battingTeamShortName)} - ${
        event.targetInning.targetRuns
      } Runs (Target)`;
    }
  }

  // const secondLine =
  //   isSecondInningRunning && event.targetInning
  //     ? `${secondInningFlag ? secondInningFlag + " " : ""}${normalizeTeamShort(
  //         event.targetInning.battingTeamShortName
  //       )} - ${event.targetInning.targetRuns} Runs (Target)`
  //     : "";

  const baseScoreLine = secondLine
    ? `${firstLine} \n${secondLine} `
    : firstLine;

  let finalTweet = `${universalHeader}\n\n`;

  const commentaryTexts = await generateCommentaryTweet(
    event,
    rawCommentary,
    team1Short,
    team2Short
  );

  const commentary = commentaryTexts?.trim() ? commentaryTexts.trim() : "";

  const scoreLine = `${baseScoreLine}`;
  let safeStatus = safeLine(event?.scoreCardStatus);

  const safeScore = safeLine(scoreLine);
  if (commentary) {
    finalTweet += `${commentary}\n\n`;
  }

  if (safeScore) {
    finalTweet += `${safeScore}\n\n`;
  }
  if (safeStatus) {
    finalTweet += `${safeStatus}\n\n`;
  }

  const hashtags = buildHashtags(
    match,
    match.team1Short,
    match.team2Short,
    event.batterName,
    event.bowlerName,
    event.type,
    event.series
  );
  const team1Flag = getFlagEmoji(team1Short);
  const team2Flag = getFlagEmoji(team2Short);
  const currentRuns = event.runs;
  const currentOvers = event.overs;
  const currentWicket = event.wickets;
  const targetRuns = event.targetInning.targetRuns;

  let tweet = premiumTemplateSix(
    team1Short,
    team2Short,
    format,
    commentary,
    team1Flag,
    team2Flag,
    currentRuns,
    currentOvers,
    currentWicket,
    targetRuns,
    safeStatus,
    hashtags
  );
  // console.log("by template::");
  // console.log(tweet);

  finalTweet += `${hashtags}`;

  // log("Final Tweet:::");
  // log(finalTweet.trim());

  // return finalTweet.trim();
  return tweet.trim();
}
