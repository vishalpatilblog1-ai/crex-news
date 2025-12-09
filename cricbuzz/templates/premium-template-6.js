import { splitCommentary } from "../match-events/tossAndResultHandler.js";
import { bold } from "../templates.js";

export function premiumTemplateSix(
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
  safeStatus,
  hashtags
) {
  const flag1 = team1Flag ? `${team1Flag} ` : "🚨";
  const flag2 = team2Flag ? `${team2Flag} ` : "🚨";

  const headline = bold(
    `${flag1} ${team1Short} vs ${team2Short} ${format} UPDATES ${flag2}`
  );
  let localTweet = `${headline}\n\n`;

  const { commLine1, commLine2 } = splitCommentary(commentary);

  if (commLine1) {
    localTweet += bold(`${commLine1}\n`);
  }

  if (commLine2) {
    localTweet += `${commLine2}\n\n`;
  }
  const lineOne = `🟩 ${bold(
    team1Short
  )} – ${currentRuns}/${currentWicket} (${currentOvers} Overs)`;

  if (lineOne) {
    localTweet += isSecondInningRunning ? `${lineOne}\n` : `${lineOne}\n\n`;
  }

  const lineTwo = true
    ? `🟧 ${bold(team2Short)} - ${targetRuns} Runs (Target)`
    : "";

  if (isSecondInningRunning && lineTwo) {
    localTweet += `${lineTwo}\n\n`;
  }

  if (isSecondInningRunning && safeStatus) {
    localTweet += `📊 ${safeStatus}\n\n`;
  }
  if (hashtags) {
    localTweet += `${hashtags}\n\n`;
  }

  return localTweet.trim();
}
