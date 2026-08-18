import path from "node:path";
import { pathToFileURL } from "node:url";
import dotenv from "dotenv";

// Load .env from the directory where this command is executed.
dotenv.config();

const SUPPORTED_PROVIDERS = new Set(["gpt", "gemini", "claude"]);

function printUsage() {
  console.log(`
Usage:
  node ndtv/testNdtvTweet.js <ndtv-url> [provider]

Providers:
  gpt       Uses generateGPTTweetWithType from ../ai/generate-gpt-tweet.js
  gemini    Uses generateGeminiTweet from ../ai/generate-gemini-tweet.js
  claude    Uses generateClaudeTweetWithType from ../ai/generateClaudeTweet.js

Examples:
  node ndtv/testNdtvTweet.js "https://sports.ndtv.com/sri-lanka-vs-india-2026/controversy-hits-india-vs-sri-lanka-1st-test-as-dhruv-jurels-low-catch-splits-internet-11926219" gpt
  node ndtv/testNdtvTweet.js "https://sports.ndtv.com/cricket/example" gemini
  node ndtv/testNdtvTweet.js "https://sports.ndtv.com/cricket/example" claude

Optional:
  AI_DIR=../some-other-ai-folder node ndtv/testNdtvTweet.js "ARTICLE_URL" claude

AI_DIR is resolved relative to this test file. Its default value is ../ai.
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

  if (!/(^|\.)ndtv\.com$/i.test(url.hostname)) {
    throw new Error("Only ndtv.com article URLs are supported.");
  }

  return url.toString();
}

function assertApiKey(provider) {
  const requiredKey = {
    gpt: "OPENAI_API_KEY",
    gemini: "GEMINI_API_KEY",
    claude: "ANTHROPIC_API_KEY",
  }[provider];

  if (!process.env[requiredKey]) {
    throw new Error(
      `${requiredKey} is missing from the environment/.env file.`,
    );
  }
}

function getThisDirectory() {
  return path.dirname(new URL(import.meta.url).pathname);
}

async function importFromAi(fileName) {
  const aiDirectory = process.env.AI_DIR || "../ai";
  const modulePath = path.resolve(getThisDirectory(), aiDirectory, fileName);

  try {
    const module = await import(pathToFileURL(modulePath).href);

    return {
      module,
      modulePath,
    };
  } catch (error) {
    throw new Error(
      `Could not load AI module from ${modulePath}. ` +
        `Update AI_DIR if needed.\n${error.message}`,
    );
  }
}

async function classifyNDTVArticle(articleText) {
  const { module, modulePath } = await importFromAi("generateClaudeTweet.js");

  const classifyArticle = module.classifyArticle;

  if (typeof classifyArticle !== "function") {
    throw new Error(`classifyArticle was not exported by ${modulePath}.`);
  }

  return classifyArticle(articleText);
}

async function loadTweetGenerator(provider) {
  if (provider === "gpt") {
    const { module, modulePath } = await importFromAi("generate-gpt-tweet.js");

    const generator = module.generateGPTTweetWithType;

    if (typeof generator !== "function") {
      throw new Error(
        `generateGPTTweetWithType was not exported by ${modulePath}.`,
      );
    }

    return {
      modulePath,
      generate: (articleText, articleType) =>
        generator(articleText, articleType),
    };
  }

  if (provider === "gemini") {
    const { module, modulePath } = await importFromAi(
      "generate-gemini-tweet.js",
    );

    const generator = module.generateGeminiTweet;

    if (typeof generator !== "function") {
      throw new Error(`generateGeminiTweet was not exported by ${modulePath}.`);
    }

    return {
      modulePath,
      generate: (articleText) => generator(articleText),
    };
  }

  const { module, modulePath } = await importFromAi("generateClaudeTweet.js");

  const generator = module.generateClaudeTweetWithType;

  if (typeof generator !== "function") {
    throw new Error(
      `generateClaudeTweetWithType was not exported by ${modulePath}.`,
    );
  }

  return {
    modulePath,
    generate: (articleText, articleType) =>
      generator(articleText, articleType, "NDTV"),
  };
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
  const [, , rawUrl, rawProvider = "claude"] = process.argv;

  if (!rawUrl || rawUrl === "--help" || rawUrl === "-h") {
    printUsage();
    process.exitCode = rawUrl ? 0 : 1;
    return;
  }

  const provider = rawProvider.toLowerCase().trim();

  if (!SUPPORTED_PROVIDERS.has(provider)) {
    throw new Error(
      `Unsupported provider "${rawProvider}". ` + `Use gpt, gemini, or claude.`,
    );
  }

  const articleUrl = validateUrl(rawUrl);

  assertApiKey(provider);

  console.log("\nFetching NDTV article...");
  console.log(`URL      : ${articleUrl}`);
  console.log(`Provider : ${provider}`);

  const { fetchNDTVArticle } = await import("./fetchNDTVArticle.js");

  const { parseNDTVArticle } = await import("./parseNDTVArticle.js");

  // Fetch raw HTML
  const html = await fetchNDTVArticle(articleUrl);

  // Parse NDTV article
  const parsed = parseNDTVArticle(html);

  if (!parsed?.headline || !parsed?.body || parsed.body.length < 30) {
    throw new Error(
      "Could not extract a usable headline/body. " +
        "NDTV may have changed the page structure " +
        "or blocked the request.",
    );
  }

  const articleText = `${parsed.headline}\n${parsed.body}`;

  // Default article type
  let articleType = "player_form";

  try {
    articleType = await classifyNDTVArticle(articleText);
  } catch (error) {
    console.warn(
      `⚠️ classifyArticle failed; using default "${articleType}":`,
      error?.message || error,
    );
  }

  const { generate, modulePath } = await loadTweetGenerator(provider);

  console.log(`Generator    : ${modulePath}`);

  console.log(`Headline     : ${parsed.headline}`);

  console.log(`Paragraphs   : ${parsed.paragraphCount ?? "unknown"}`);

  console.log(`Article Type : ${articleType}`);

  if (parsed.table?.length) {
    console.log(`Table rows   : ${parsed.table.length}`);
  }

  console.log("\nGenerating tweet...\n");

  const result = await generate(articleText, articleType);

  const tweet = extractTweetText(result);

  if (!tweet) {
    console.dir(result, {
      depth: 4,
    });

    throw new Error("The selected generator returned an empty tweet.");
  }

  console.log("================ FULL NDTV ARTICLE ================\n");

  console.log(articleText);
  console.log("\n====================================================");

  if (parsed.table?.length) {
    console.log("\n================ PARSED TABLE ======================\n");

    console.dir(parsed.table, {
      depth: 6,
    });
  }

  //   console.log("\n================ GENERATED TWEET ===================\n");

  //   console.log(tweet);

  //   console.log("\n====================================================");

  console.log(`Characters: ${tweet.length}`);

  if (result?.articleType) {
    console.log(`Generator article type: ${result.articleType}`);
  }

  if (result?.card) {
    console.log("Card data:");

    console.dir(result.card, {
      depth: 4,
    });
  }

  console.log();
}

main().catch((error) => {
  console.error("\nTest failed:", error?.message || error);

  process.exitCode = 1;
});

// Example:
// node ndtv/testNdtvTweet.js "https://sports.ndtv.com/cricket/your-ndtv-article" claude
