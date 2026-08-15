import dotenv from "dotenv";
import { generateClaudeTweetWithType } from "../ai/generateClaudeTweet.js";

dotenv.config();

function printUsage() {
  console.log(`
Usage:
  node sportskeeda/testSKTweet.js <sportskeeda-url>

Example:
  node sportskeeda/testSKTweet.js "https://www.sportskeeda.com/cricket/news-example"

This test:
  - parses only the requested Sportskeeda article
  - builds fullText exactly like skNewsPollingLoop.js
  - classifies the article
  - generates the tweet using generateGPTTweetWithType()
  - does NOT enqueue a tweet
  - does NOT update global.STATE
  - does NOT mark the article as seen
`);
}

function validateUrl(value) {
  let url;

  try {
    url = new URL(value);
  } catch {
    throw new Error("Input must be a valid URL.");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only HTTP/HTTPS URLs are supported.");
  }

  if (!/(^|\.)sportskeeda\.com$/i.test(url.hostname)) {
    throw new Error("Only sportskeeda.com article URLs are supported.");
  }

  return url.toString();
}

function assertApiKey() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is missing from the environment/.env file.",
    );
  }
}

function extractTweetText(result) {
  if (typeof result === "string") {
    return result.trim();
  }

  if (result && typeof result.tweetText === "string") {
    return result.tweetText.trim();
  }

  return "";
}

async function main() {
  const [, , rawUrl] = process.argv;

  if (!rawUrl || rawUrl === "--help" || rawUrl === "-h") {
    printUsage();
    process.exitCode = rawUrl ? 0 : 1;
    return;
  }

  assertApiKey();

  const articleUrl = validateUrl(rawUrl);

  console.log("\nFetching Sportskeeda article...");
  console.log(`URL: ${articleUrl}`);

  const { parseSKArticle } = await import("./parseSKArticle.js");

  const { classifyArticle, generateGPTTweetWithType } =
    await import("../ai/generate-gpt-tweet.js");

  const selectedItem = {
    link: articleUrl,
  };

  const parsed = await parseSKArticle(selectedItem);

  if (!parsed?.headline || !parsed?.body) {
    throw new Error(
      "Could not extract Sportskeeda headline/body. The page may be blocked or its structure may have changed.",
    );
  }

  //
  // Same as skNewsPollingLoop.js
  //
  const fullText = `${parsed.headline}\n${parsed.body}`;

  if (fullText.length < 80) {
    throw new Error(
      `Sportskeeda article text is too short (${fullText.length} chars).`,
    );
  }

  console.log(`Headline   : ${parsed.headline}`);
  console.log(`Text chars : ${fullText.length}`);

  let articleType = "player_form";

  try {
    articleType = await classifyArticle(fullText);
  } catch (error) {
    console.warn(
      "⚠️ classifyArticle failed, using default player_form:",
      error?.message || error,
    );
  }

  console.log(`Article type: ${articleType}`);
  console.log("\nGenerating tweet...\n");

  const result = await generateClaudeTweetWithType(fullText, articleType);

  const tweet = extractTweetText(result);

  if (!tweet) {
    console.dir(result, { depth: 5 });

    throw new Error("generateGPTTweetWithType returned an empty tweet.");
  }
  console.log("================== Full Article ==================\n");

  console.log(fullText);

  console.log("\n================ GENERATED TWEET ================\n");

  console.log(tweet);

  console.log("\n=================================================");

  console.log(`Characters: ${tweet.length}`);

  if (result?.player) {
    console.log(`Player    : ${result.player}`);
  }

  if (result?.articleType) {
    console.log(`AI type   : ${result.articleType}`);
  }

  if (result?.card) {
    console.log("\nCard data:");
    console.dir(result.card, { depth: 5 });
  }

  console.log();
}

main().catch((error) => {
  console.error("\nTest failed:", error?.message || error);

  process.exitCode = 1;
});
