import { formatMatchTitle } from "./utils/matchFormatting.js";

function buildFinalTweet(matchName, eventText) {
  const title = formatMatchTitle(matchName);
  return `${title}\n\n${eventText}`;
}
