//templateEngine.js

import { buildODITemplateTweet } from "./templateEngineODI.js";

import { buildTestTemplateTweet } from "./templateEngineTest.js";

export async function buildTemplateTweet(matchContext, score) {
  const format = (matchContext?.event?.format || "").toUpperCase();

  if (format === "TEST") {
    return buildTestTemplateTweet(matchContext, score);
  }

  return buildODITemplateTweet(matchContext, score);
}
