//ai.js
import { buildTemplateTweet } from "./cricbuzz/templateEngine.js";
import { buildSimpleChaseText } from "./utils/chaseText.js";

async function generateTweet(matchContext) {
  const tweet = buildTemplateTweet(matchContext);
  if (!tweet) return "SKIP";
  return tweet;
}

export default generateTweet;
