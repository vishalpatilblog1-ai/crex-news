import { bold, getFlagEmoji } from "../templates.js";
import { buildHashtags } from "../tweet-validators/tweetValidators.js";

export function buildTossTweet(
  match,
  event,
  team1Short,
  team2Short,
  tossWinnerShortName,
  format
) {
  const tossWinner = event?.tossWinner;
  const tossDecision = event?.tossDecision;

  if (
    !tossWinner ||
    tossWinner.trim() === "" ||
    !tossDecision ||
    tossDecision.trim() === ""
  ) {
    return "SKIP";
  }

  const headline = bold(
    `🚨 ${team1Short} vs ${team2Short} ${format} UPDATES 🚨`
  );

  let tossText = `${getFlagEmoji(
    tossWinnerShortName
  )}${tossWinner} won the toss and chose to ${tossDecision}.`;

  tossText = tossText.toUpperCase();

  const hashtags = buildHashtags(
    match,
    match.team1Short,
    match.team2Short,
    event.bat1 || event.partnership?.bat1?.name,
    event.bat2 || event.partnership?.bat2?.name
  );

  return `${headline}\n
${bold("🪙 TOSS UPDATE")}

${tossText}

${hashtags}`;
}

export function buildMatchResultTweet(
  team1Short,
  team2Short,
  format,
  resultText
) {
  const headline = `🚨 ${team1Short} vs ${team2Short} ${format} UPDATES 🚨`;

  //🏆 MATCH RESULT 🏆
  return `
${bold(headline)}

${bold(resultText.toUpperCase())}

#${team1Short}vs${team2Short} #${team2Short}vs${team1Short}
`;
}
