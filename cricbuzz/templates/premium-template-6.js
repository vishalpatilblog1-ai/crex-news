import { splitCommentary } from "../match-events/tossAndResultHandler.js";
import { bold } from "../templates.js";

export function premiumTemplateSix(
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
  const headline = bold(
    `${team1Flag}  ${team1Short} vs ${team2Short} ${format} UPDATES ${team2Flag}`
  );
  const lineOne = `🟢 ${bold(
    team1Short
  )} – ${currentRuns}/${currentWicket} (${currentOvers} Overs)`;
  const lineTwo = `🟠 ${bold(team2Short)} - ${targetRuns} Runs (Target)`;

  const { commLine1, commLine2 } = splitCommentary(commentary);

  return `${headline}\n
${bold(commLine1).trim()}
${commLine2}\n
${lineOne}
${lineTwo}\n
📊 ${safeStatus}\n
${hashtags}`.trim();
}
