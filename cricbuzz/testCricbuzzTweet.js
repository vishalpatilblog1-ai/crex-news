import dotenv from "dotenv";

dotenv.config();

const SOURCE = "CB";
const SUPPORTED_PROVIDERS = new Set(["gpt", "claude"]);

function printUsage() {
  console.log(`
Usage:
  node cricbuzz/testCricbuzzTweet.js <news-id-or-cricbuzz-url> [provider]

Providers:
  claude    Uses classifyArticle + generateClaudeTweetWithType
  gpt       Uses classifyArticle + generateGPTTweetWithType

Examples:
  node cricbuzz/testCricbuzzTweet.js 135082 claude
  node cricbuzz/testCricbuzzTweet.js 135082 gpt
  node cricbuzz/testCricbuzzTweet.js "https://www.cricbuzz.com/cricket-news/135082/example-headline" claude

This test:
  - fetches only the requested Cricbuzz article
  - builds article text exactly like cricbuzzNewsPollingLoop.js
  - classifies the article
  - generates the tweet with SOURCE="CB" and longEligible=false
  - does NOT enqueue a tweet
  - does NOT update global.STATE / seen state
`);
}

function extractNewsId(value) {
  const input = String(value || "").trim();

  if (/^\d+$/.test(input)) {
    return input;
  }

  let url;

  try {
    url = new URL(input);
  } catch {
    throw new Error(
      "Input must be a Cricbuzz news ID or a valid Cricbuzz article URL.",
    );
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only HTTP/HTTPS URLs are supported.");
  }

  if (!/(^|\.)cricbuzz\.com$/i.test(url.hostname)) {
    throw new Error("Only cricbuzz.com article URLs are supported.");
  }

  const newsMatch = url.pathname.match(/\/cricket-news\/(\d+)(?:\/|$)/i);

  if (newsMatch) {
    return newsMatch[1];
  }

  const numericSegments = url.pathname
    .split("/")
    .filter(Boolean)
    .filter((segment) => /^\d+$/.test(segment));

  if (numericSegments.length > 0) {
    return numericSegments[numericSegments.length - 1];
  }

  throw new Error("Could not extract Cricbuzz news ID from the URL.");
}

function assertApiKey(provider) {
  const requiredKey = {
    gpt: "OPENAI_API_KEY",
    claude: "ANTHROPIC_API_KEY",
  }[provider];

  if (!process.env[requiredKey]) {
    throw new Error(
      `${requiredKey} is missing from the environment/.env file.`,
    );
  }
}

function buildFullArticleText(detailNews) {
  return (detailNews?.content || [])
    .filter((b) => b?.content?.contentType === "text")
    .map((b) => b.content.contentValue)
    .filter(Boolean)
    .join(" ");
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
  const [, , rawInput, rawProvider = "claude"] = process.argv;

  if (!rawInput || rawInput === "--help" || rawInput === "-h") {
    printUsage();
    process.exitCode = rawInput ? 0 : 1;
    return;
  }

  const provider = rawProvider.toLowerCase().trim();

  if (!SUPPORTED_PROVIDERS.has(provider)) {
    throw new Error(
      `Unsupported provider "${rawProvider}". Use gpt or claude.`,
    );
  }

  assertApiKey(provider);

  const newsId = extractNewsId(rawInput);

  const { getNewsDetailsByNewsId } = await import("./cricbuzzApi.js");

  console.log("\nFetching Cricbuzz article...");
  console.log(`News ID  : ${newsId}`);
  console.log(`Provider : ${provider}`);

  const detailNews = await getNewsDetailsByNewsId(newsId);

  if (!detailNews?.content) {
    throw new Error(`No Cricbuzz article content found for news ID ${newsId}.`);
  }

  const fullText = buildFullArticleText(detailNews);

  if (!fullText || fullText.length < 80) {
    throw new Error(
      `Article text is missing or too short (${fullText?.length || 0} chars).`,
    );
  }

  const { classifyArticle, generateClaudeTweetWithType } =
    await import("../ai/generateClaudeTweet.js");

  const { generateGPTTweetWithType } =
    await import("../ai/generate-gpt-tweet.js");

  let articleType = "player_form";

  try {
    articleType = await classifyArticle(fullText);
  } catch (error) {
    console.warn(
      "⚠️ classifyArticle failed, using default player_form:",
      error?.message || error,
    );
  }

  const longEligible = false;

  console.log(`Article type : ${articleType}`);
  console.log(`Text chars   : ${fullText.length}`);
  console.log("============ Full Article ==========");
  console.log(fullText);
  console.log("====================================");

  console.log("\nGenerating tweet...\n");

  let result;

  if (provider === "claude") {
    result = await generateClaudeTweetWithType(
      fullText,
      articleType,
      SOURCE,
      true,
    );
  } else {
    result = await generateGPTTweetWithType(
      fullText,
      articleType,
      SOURCE,
      longEligible,
    );
  }

  const tweet = extractTweetText(result);

  if (!tweet) {
    console.dir(result, { depth: 5 });
    throw new Error("The selected generator returned an empty tweet.");
  }

  console.log("================ GENERATED TWEET ================\n");

  console.log(tweet);

  console.log("\n=================================================");

  console.log(`Characters: ${tweet.length}`);

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
