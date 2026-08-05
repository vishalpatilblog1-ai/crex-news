import path from "node:path";
import { pathToFileURL } from "node:url";
import dotenv from "dotenv";

// Load .env from the directory where this command is executed.
dotenv.config();

const SUPPORTED_PROVIDERS = new Set(["gpt", "gemini", "claude"]);

function printUsage() {
  console.log(`
Usage:
  node cricket-addictor/testCATweet.js <cricket-addictor-url> [provider]

Providers:
  gpt       Uses generateGPTTweet from ../ai/generate-gpt-tweet.js
  gemini    Uses generateGeminiTweet from ../ai/generate-gemini-tweet.js
  claude    Uses generateClaudeTweet from ../ai/generateClaudeTweet.js

Examples:
  node cricket-addictor/testCATweet.js "https://cricketaddictor.com/cricket-news/example/" gpt
  node cricket-addictor/testCATweet.js "https://cricketaddictor.com/cricket-news/example/" gemini
  node cricket-addictor/testCATweet.js "https://cricketaddictor.com/cricket-news/example/" claude

Optional:
  AI_DIR=../some-other-ai-folder node cricket-addictor/testCATweet.js "ARTICLE_URL" gpt

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

  if (!/(^|\.)cricketaddictor\.com$/i.test(url.hostname)) {
    throw new Error("Only cricketaddictor.com article URLs are supported.");
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

async function loadTweetGenerator(provider) {
  const aiDirectory = process.env.AI_DIR || "../ai";
  const generators = {
    gpt: {
      file: "generate-gpt-tweet.js",
      exportName: "generateGPTTweet",
    },
    gemini: {
      file: "generate-gemini-tweet.js",
      exportName: "generateGeminiTweet",
    },
    claude: {
      file: "generateClaudeTweet.js",
      exportName: "generateClaudeTweet",
    },
  };

  const config = generators[provider];
  const modulePath = path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    aiDirectory,
    config.file,
  );

  let module;
  try {
    module = await import(pathToFileURL(modulePath).href);
  } catch (error) {
    throw new Error(
      `Could not load ${provider} generator from ${modulePath}. ` +
        `Update AI_DIR or the mapping in testCATweet.js.\n${error.message}`,
    );
  }

  const generator = module[config.exportName];
  if (typeof generator !== "function") {
    throw new Error(`${config.exportName} was not exported by ${modulePath}.`);
  }

  return { generator, modulePath };
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
  const [, , rawUrl, rawProvider = "gpt"] = process.argv;

  if (!rawUrl || rawUrl === "--help" || rawUrl === "-h") {
    printUsage();
    process.exitCode = rawUrl ? 0 : 1;
    return;
  }

  const provider = rawProvider.toLowerCase().trim();
  if (!SUPPORTED_PROVIDERS.has(provider)) {
    throw new Error(
      `Unsupported provider "${rawProvider}". Use gpt, gemini, or claude.`,
    );
  }

  const articleUrl = validateUrl(rawUrl);
  assertApiKey(provider);

  console.log("\nFetching Cricket Addictor article...");
  console.log(`URL      : ${articleUrl}`);
  console.log(`Provider : ${provider}`);

  const { parseCAArticle } = await import("./parseCAArticle.js");
  const parsed = await parseCAArticle({ link: articleUrl });

  if (!parsed?.headline || !parsed?.body) {
    throw new Error(
      "Could not extract the headline/body. The page structure may have changed or blocked the request.",
    );
  }

  const articleText = `${parsed.headline}\n${parsed.body}`;
  const { generator, modulePath } = await loadTweetGenerator(provider);

  console.log(`Generator: ${modulePath}`);
  console.log(`Headline : ${parsed.headline}`);
  console.log(`Paragraphs: ${parsed.paragraphCount ?? "unknown"}`);
  console.log("\nGenerating tweet...\n");

  const result = await generator(articleText);
  const tweet = extractTweetText(result);

  if (!tweet) {
    console.dir(result, { depth: 4 });
    throw new Error("The selected generator returned an empty tweet.");
  }

  // console.log("================ GENERATED TWEET ================\n");
  // console.log(tweet);
  // console.log("\n=================================================");
  console.log(`Characters: ${tweet.length}`);

  if (result?.articleType) {
    console.log(`Article type: ${result.articleType}`);
  }

  // if (result?.card) {
  //   console.log("Card data:");
  //   console.dir(result.card, { depth: 4 });
  // }

  console.log();
}

main().catch((error) => {
  console.error("\nTest failed:", error?.message || error);
  process.exitCode = 1;
});
