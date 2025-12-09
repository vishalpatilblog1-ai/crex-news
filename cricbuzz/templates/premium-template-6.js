import { splitCommentary } from "../match-events/tossAndResultHandler.js";
import { bold } from "../templates.js";
import { normalizeTeamShort } from "../tweet-validators/tweetValidators.js";

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
  event
) {
  const flag1 = team1Flag || "🚨";
  const flag2 = team2Flag || "🚨";

  const headline = bold(
    `${flag1} ${normalizeTeamShort(team1Short)} vs ${normalizeTeamShort(
      team2Short
    )} ${format} UPDATES ${flag2}`
  );

  let localTweet = `${headline}\n\n`;

  const { commLine1, commLine2 } = splitCommentary(commentary);
  if (commLine1) localTweet += bold(`${commLine1}\n`);
  if (commLine2) localTweet += `${commLine2}\n\n`;

  const battingTeam = normalizeTeamShort(
    event?.batteamsnameShort || event?.batteamsname
  );

  const targetTeam = normalizeTeamShort(
    event?.targetInning?.battingTeamShortName
  );

  const currentInningLine = `🟩 ${bold(
    battingTeam
  )} – ${currentRuns}/${currentWicket} (${currentOvers} Overs)`;

  let targetInningLine = "";
  if (isSecondInningRunning && targetRuns) {
    targetInningLine = `🟧 ${bold(targetTeam)} – ${targetRuns} Runs (Target)`;
  }

  localTweet += `${currentInningLine}\n`;
  if (targetInningLine) localTweet += `${targetInningLine}\n\n`;

  if (isSecondInningRunning && safeStatus) {
    localTweet += `📊 ${safeStatus}\n\n`;
  }

  if (hashtags) localTweet += `${hashtags}\n`;

  return localTweet.trim();
}
