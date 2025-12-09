export function premiumTemplateTwo(
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
  const headline = `${team1Flag}  ${team1Short} vs ${team2Short} ${team2Flag}`;
  const lineOne = `📊 ${team1Short} – ${currentRuns}/${currentWicket} (${currentOvers} Overs)`;
  const lineTwo = `${team2Flag} ${team2Short} - ${targetRuns} Runs (Target)`;

  return `${headline}\n
${commentary}\n
${lineOne}
${lineTwo}\n
${safeStatus}\n
${hashtags}`.trim();
}
