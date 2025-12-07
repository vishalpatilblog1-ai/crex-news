//ai.js
import { buildTemplateTweet } from "../templateEngine.js";

export async function generateTweet(matchContext, score) {
  const tweet = buildTemplateTweet(matchContext, score);
  if (!tweet) return "SKIP";
  return tweet;
}

export default generateTweet;
