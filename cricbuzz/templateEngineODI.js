//templateEngine.js

import { generateCommentaryTweet } from "./ai/aiCommentaryTweet.js";
import { getFlagEmoji } from "./templates.js";
import { premiumTemplateOne } from "./templates/premium-template-1-default.js";
import { premiumTemplateSix } from "./templates/premium-template-6.js";

import {
  buildHashtags,
  headlineValidator,
} from "./tweet-validators/tweetValidators.js";

export async function buildODITemplateTweet({ event }, score = null) {
  const {
    team1Short,
    team2Short,
    format,
    scoreCardStatus,
    batteamsname: battingTeam,
  } = event;

  console.log("Event ODI all::", event);

  const rawCommentary = event?.commentaryTexts?.[0];
  const isSecondInningRunning = event?.inningsid === 2;

  const universalHeader = headlineValidator(team1Short, team2Short, format);

  if (!event || !event?.type) return null;

  globalThis.TWEET_COUNTER = (globalThis.TWEET_COUNTER || 0) + 1;
  const targetTeam = event.targetInning?.battingTeamShortName;

  const firstInningFlag = getFlagEmoji(event.batteamsname);
  const secondInningFlag = getFlagEmoji(targetTeam);

  const firstLine = `${
    firstInningFlag ? firstInningFlag + " " : ""
  }${battingTeam} - ${event.runs}/${event.wickets} (${event.overs} Overs)`;

  let secondLine = "";

  if (isSecondInningRunning && event.targetInning) {
    secondLine = `${secondInningFlag ? secondInningFlag + " " : ""}${
      event.targetInning.battingTeamShortName
    } - ${event.targetInning.targetRuns} Runs (Target)`;
  }

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

  finalTweet += `${commentary}\n\n`;
  finalTweet += `${baseScoreLine}\n\n`;
  finalTweet += `${scoreCardStatus}\n\n`;

  const hashtags = buildHashtags(
    format,
    team1Short,
    team2Short,
    event.batterName,
    event.bowlerName,
    event.type,
    event.series
  );
  const team1Flag = getFlagEmoji(team1Short) || "";
  const team2Flag = getFlagEmoji(team2Short) || "";
  const currentRuns = event.runs || 0;
  const currentOvers = event.overs || 0.0;
  const currentWicket = event.wickets || 0;
  const targetRuns = event.targetInning.targetRuns || 0;

  let tweet = premiumTemplateSix(
    isSecondInningRunning,
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
    scoreCardStatus,
    hashtags,
    battingTeam,
    targetTeam
  );

  // let tweet1 = premiumTemplateOne(
  //   isSecondInningRunning,
  //   team1Short,
  //   team2Short,
  //   format,
  //   commentary,
  //   team1Flag,
  //   team2Flag,
  //   currentRuns,
  //   currentOvers,
  //   currentWicket,
  //   targetRuns,
  //   scoreCardStatus,
  //   hashtags,
  //   battingTeam,
  //   targetTeam
  // );

  finalTweet += `${hashtags}`;

  // log("Final Tweet:::");
  // console.log(tweet.trim());
  // console.log(finalTweet.trim());

  // return finalTweet.trim();
  return tweet.trim();
}
