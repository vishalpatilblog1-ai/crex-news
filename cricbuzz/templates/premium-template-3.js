import { splitCommentary } from "../match-events/tossAndResultHandler.js";

export function premiumTemplateThree(
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
  const headline = `🟢 LIVE MATCH UPDATES 🟢`;

  const lineOne = `${team1Flag} ${team1Short} – ${currentRuns}/${currentWicket} (${currentOvers} Overs)`;
  const lineTwo = `${team2Flag} ${team2Short} - ${targetRuns} Runs (Target)`;

  const { commLine1, commLine2 } = splitCommentary(commentary);

  return `${headline}\n
${commLine1}\n
${lineOne}
${lineTwo}\n
🧮 Requirement: ${safeStatus}\n
${hashtags}`.trim();
}
