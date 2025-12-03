//ai.js
import { buildTemplateTweet } from "../templateEngine.js";

export async function generateTweet(matchContext) {
  const tweet = buildTemplateTweet(matchContext);
  if (!tweet) return "SKIP";
  return tweet;
}

export default generateTweet;
