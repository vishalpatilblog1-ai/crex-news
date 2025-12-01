export function basicTemplateThree(
  team1Short,
  team2Short,
  team1Long,
  team2Long,
  format,
  commentary,
  team1Flag,
  team2Flag,
  currentRuns,
  currentOvers,
  currentWicket,
  chaseTeam,
  runsNeeded,
  ballsLeft,
  targetRuns,
  hashtags
) {
  const headline = `🟢 LIVE MATCH UPDATES 🟢`;

  const lineOne = `${team1Flag} ${team1Short} – ${currentRuns}/${currentWicket} (${currentOvers} Overs)`;
  const lineTwo = `${team2Flag} ${team2Short} - ${targetRuns} Runs (Target)`;
  let chaseLine = "";
  if (chaseTeam && runsNeeded != null && ballsLeft != null) {
    chaseLine = `${chaseTeam} need ${runsNeeded} runs in ${ballsLeft} balls`;
  }
  const { commLine1, commLine2 } = splitCommentary(commentary);

  return `${headline}\n
  ${commLine1}\n
  ${lineOne}
  ${lineTwo}\n
  🧮 Requirement: ${chaseLine}\n
  ${hashtags}`.trim();
}
