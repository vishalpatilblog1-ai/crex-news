export function basicTemplateFive(
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
  const headline = `🛑 LIVE NOW: ${team1Short} vs ${team2Short} ${format} 🛑`;
  const lineOne = `${team1Flag} ${team1Short} – ${currentRuns}/${currentWicket} (${currentOvers} Overs)`;
  const lineTwo = `${team2Flag} ${team2Short} - ${targetRuns} Runs (Target)`;
  let chaseLine = "";
  if (chaseTeam && runsNeeded != null && ballsLeft != null) {
    chaseLine = `${chaseTeam} need ${runsNeeded} runs in ${ballsLeft} balls`;
  }

  return `${headline}\n
  ${commentary}\n
  ${lineOne}
  ${lineTwo}\n
  ${chaseLine}\n
  ${hashtags}`.trim();
}
