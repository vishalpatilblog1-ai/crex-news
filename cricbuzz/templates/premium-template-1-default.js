import { splitCommentary } from "../match-events/tossAndResultHandler.js";
import { bold, getFlagEmoji, italic } from "../templates.js";

export function premiumTemplateOne(
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
  const flagBat = getFlagEmoji(battingTeam) || "🏏";
  const flagTarget = getFlagEmoji(targetTeam) || "🎯";

  const headline = `🚨 ${team1Short} vs ${team2Short} ${format} UPDATES 🚨`;

  let localTweet = `${headline}\n\n`;

  const { commLine1, commLine2 } = splitCommentary(commentary);
  if (commLine1) localTweet += `${commLine1}\n`;
  if (commLine2) localTweet += `${commLine2}\n\n`;

  const currentInningLine = `${battingTeam} – ${currentRuns}/${currentWicket} (${currentOvers} Overs)\n`;

  let targetInningLine = "";
  if (isSecondInningRunning && targetRuns) {
    targetInningLine = `${targetTeam} – ${targetRuns} Runs (Target)`;
  }

  localTweet += `${currentInningLine}\n`;
  if (targetInningLine) localTweet += `${targetInningLine}\n\n`;

  // if (isSecondInningRunning && safeStatus) {
  localTweet += `${safeStatus}\n\n`;
  // }

  if (hashtags) localTweet += italic(`${hashtags}\n`);

  return localTweet.trim();
}
