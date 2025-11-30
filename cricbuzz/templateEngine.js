//templateEngine.js

import { generateCommentaryTweet } from "./ai/aiCommentaryTweet.js";
import { buildMatchResultTemplate, getFlagEmoji } from "./templates.js";
import {
  buildHashtags,
  headlineValidator,
  normalizeTeamShort,
  safeLine,
} from "./tweet-validators/tweetValidators.js";

function cleanEventLog(event) {
  if (!event) return event;

  const { batsman, bowler, ...rest } = event;
  return rest;
}
function computeChaseStatus(event) {
  if (!event?.targetInning?.targetRuns || !event?.overs) return null;

  const target = event.targetInning.targetRuns;
  const winningScore = target + 1;

  const currentRuns = event.runs;

  const runsNeeded = Math.max(winningScore - currentRuns, 0);

  // Parse overs like 37.5 → ov=37, ball=5
  const [ovStr, ballStr] = event.overs.toString().split(".");
  const overs = parseInt(ovStr, 10);
  const balls = parseInt(ballStr || "0", 10);

  const ballsBowled = overs * 6 + balls;
  const totalBalls = 50 * 6; // ODI
  const ballsLeft = Math.max(totalBalls - ballsBowled, 0);

  return { runsNeeded, ballsLeft };
}

export async function buildTemplateTweet(matchContext) {
  const { match, event } = matchContext;
  console.log("event buildTemplateTweet::", cleanEventLog(event));
  console.log("match buildTemplateTweet::", match);

  const rawCommentary = matchContext?.event?.commentaryTexts?.[0];
  const isSecondInningRunning = event?.inningsid === 2;

  const team1Short = matchContext?.match?.team1Short || "";
  const team2Short = matchContext?.match?.team2Short || "";
  const format = (match?.format || "").toUpperCase() || "";

  const universalHeader = headlineValidator(team1Short, team2Short, format);

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

    const hashtags = buildHashtags(
      match,
      match.team1Short,
      match.team2Short,
      event.bat1 || event.partnership?.bat1?.name,
      event.bat2 || event.partnership?.bat2?.name
    );

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

  let targetLineShort = "";
  if (event.type === "WICKET" && event.targetInning?.targetRuns) {
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

  const secondLine =
    isSecondInningRunning && event.targetInning
      ? `${secondInningFlag ? secondInningFlag + " " : ""}${normalizeTeamShort(
          event.targetInning.battingTeamShortName
        )} - ${event.targetInning.targetRuns} Runs (Target)`
      : "";

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

  if (isSecondInningRunning && event.targetInning) {
    const chase = computeChaseStatus(event);
    if (chase) {
      safeStatus = `${normalizeTeamShort(event.batteamsname)} need ${
        chase.runsNeeded
      } runs in ${chase.ballsLeft} balls`;
    }
  } else {
    safeStatus = safeLine(match.status);
  }

  const safeScore = safeLine(scoreLine);
  if (commentary) {
    finalTweet += `${commentary}\n\n`;
  }

  if (safeScore) {
    finalTweet += `${safeScore}\n\n`;
  }
  if (safeStatus) finalTweet += `${safeStatus}\n\n`;

  const hashtags = buildHashtags(
    match,
    match.team1Short,
    match.team2Short,
    event.batterName,
    event.bowlerName,
    event.type

    // event.bat2 || event.partnership?.bat2?.name
  );

  finalTweet += `${hashtags}`;

  return finalTweet.trim();
}
