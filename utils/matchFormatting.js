// utils/matchFormatting.js
import { teamEmoji } from "./teamEmoji.js";

export function formatMatchTitle(matchName) {
  const [team1, team2] = matchName.split(" vs ");
  const emoji1 = teamEmoji(team1);
  const emoji2 = teamEmoji(team2);

  return `${emoji1} ${matchName} Updates ${emoji2}`;
}

// 🔥 THIS WAS MISSING — now added
export function buildFinalTweet(matchName, eventText) {
  const title = formatMatchTitle(matchName);
  return `${title}\n\n${eventText}`;
}
