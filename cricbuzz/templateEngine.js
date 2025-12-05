//templateEngine.js

import { createLogger } from "../utils/logger.js";
import { generateCommentaryTweet } from "./ai/aiCommentaryTweet.js";
import { getFlagEmoji } from "./templates.js";
import { premiumTemplateOne } from "./templates/premium-template-1.js";
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
// export function computeChaseStatus(event, format) {
//   // console.log("status::", event);
//   if (!event?.targetInning?.targetRuns || !event?.overs) return null;

//   const runs = event.targetInning.targetRuns;
//   const winningScore = runs + 1;

//   const currentRuns = event.runs;
//   const runsNeeded = Math.max(winningScore - currentRuns, 0);

//   const [ovStr, ballStr] = event.overs.toString().split(".");
//   const overs = parseInt(ovStr, 10);
//   const balls = parseInt(ballStr || "0", 10);

//   const ballsBowled = overs * 6 + balls;

//   let totalBalls = 120;

//   const fmt = (format || "").toUpperCase();

//   if (fmt === "T20") totalBalls = 20 * 6;
//   else if (fmt === "ODI") totalBalls = 50 * 6;
//   else if (fmt === "T10") totalBalls = 10 * 6;
//   else if (fmt === "TEST") totalBalls = 90 * 6;

//   const ballsLeft = Math.max(totalBalls - ballsBowled, 0);

//   return { runsNeeded, ballsLeft };
// }

export function computeChaseStatus(event, format, status) {
  if (!event?.targetInning?.targetRuns || !event?.overs) return null;

  const fmt = (format || "").toUpperCase();

  if (fmt === "TEST") return null;

  const runs = event.targetInning.targetRuns;
  const winningScore = runs + 1;

  const currentRuns = event.runs;
  const runsNeeded = Math.max(winningScore - currentRuns, 0);

  const [ovStr, ballStr] = event.overs.toString().split(".");
  const overs = parseInt(ovStr, 10);
  const balls = parseInt(ballStr || "0", 10);
  const ballsBowled = overs * 6 + balls;

  let totalBalls = 20 * 6; // default T20
  if (fmt === "ODI") totalBalls = 50 * 6;
  else if (fmt === "T10") totalBalls = 10 * 6;

  const ballsLeft = Math.max(totalBalls - ballsBowled, 0);

  return { runsNeeded, ballsLeft };
}

export async function buildTemplateTweet(matchContext) {
  const { match, event } = matchContext;

  log("event buildTemplateTweet::", cleanEventLog(event));
  log("match buildTemplateTweet::", match);

  console.log("event buildTemplateTweet::", cleanEventLog(event));
  console.log("match buildTemplateTweet::", match);

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
  let safeStatus = "";
  if (format === "TEST") {
    safeStatus = match.status;
  } else if (isSecondInningRunning && event.targetInning) {
    const chase = computeChaseStatus(event, match?.format);

    if (chase) {
      safeStatus = `${normalizeTeamShort(event.batteamsname)} need ${
        chase.runsNeeded
      } runs in ${chase.ballsLeft} balls`;
    }
  } else {
    safeStatus = safeLine(match.status);
  }

  // if (isSecondInningRunning && event.targetInning) {
  //   const chase = computeChaseStatus(event, match?.format, match?.status);

  //   if (chase) {
  //     safeStatus = `${normalizeTeamShort(event.batteamsname)} need ${
  //       chase.runsNeeded
  //     } runs in ${chase.ballsLeft} balls`;
  //   }
  // } else {
  //   safeStatus = safeLine(match.status);
  // }
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

  finalTweet += `${hashtags}`;

  // log("Final Tweet:::");
  // log(finalTweet.trim());

  return finalTweet.trim();
}
