import { splitCommentary } from "../match-events/tossAndResultHandler.js";
import { bold, getFlagEmoji, italic } from "../templates.js";

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
  hashtags,
  battingTeam,
  targetTeam
) {
  // const flag1 = team1Flag || "🚨";
  // const flag2 = team2Flag || "🚨";
  const headerFlag1 = team1Flag || "🚨";
  const headerFlag2 = team2Flag || "🚨";

  const flagBat = getFlagEmoji(battingTeam) || "🏏";
  const flagTarget = getFlagEmoji(targetTeam) || "🎯";

  const headline = bold(
    `${headerFlag1} ${team1Short} vs ${team2Short} ${format} UPDATES ${headerFlag2}`
  );

  let localTweet = `${headline}\n\n`;

  const { commLine1, commLine2 } = splitCommentary(commentary);
  if (commLine1) localTweet += bold(`${commLine1}\n`);
  if (commLine2) localTweet += `${commLine2}\n\n`;

  const currentInningLine = `🟩 ${battingTeam} – ${currentRuns}/${currentWicket} (${currentOvers})`;

  let targetInningLine = "";
  if (isSecondInningRunning && targetRuns) {
    targetInningLine = `🟧 ${targetTeam} – ${targetRuns} (Target)`;
  }

  localTweet += bold(`${currentInningLine}\n`);
  if (targetInningLine) localTweet += bold(`${targetInningLine}\n\n`);

  if (isSecondInningRunning && safeStatus) {
    localTweet += `🟦 ${safeStatus}\n\n`.toUpperCase();
  }

  if (hashtags) localTweet += `${hashtags}\n`;

  return localTweet.trim();
}
