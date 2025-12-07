//templateEngine.js

import { createLogger } from "../utils/logger.js";
import { buildLOITemplateTweet } from "./templateEngineLOI.js";
import { buildTestTemplateTweet } from "./templateEngineTest.js";

export async function buildTemplateTweet(matchContext, score) {
  const format = (matchContext?.match?.format || "").toUpperCase();

  if (format === "TEST") {
    return buildTestTemplateTweet(matchContext, score);
  }

  return buildLOITemplateTweet(matchContext, score);
}
