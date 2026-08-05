import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import "dotenv/config";

import { parseSKArticle } from "./parseSKArticle.js";

const SUPPORTED_PROVIDERS = new Set(["gpt", "gemini", "claude"]);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function printUsage() {
  console.log(`
Usage:
  node sportskeeda-cricket/testSKTweet.js <sportskeeda-cricket-url> [provider]

Providers: gpt | gemini | claude
AI_DIR defaults to ../ai and is resolved from this file.
`);
}

function validateUrl(rawUrl) {
  const url = new URL(rawUrl);
  if (!/(^|\.)sportskeeda\.com$/i.test(url.hostname)) {
    throw new Error("Only sportskeeda.com URLs are supported.");
  }
  if (!url.pathname.startsWith("/cricket/")) {
    throw new Error("The URL must be a Sportskeeda cricket article.");
  }
  return url.toString();
}

function assertApiKey(provider) {
  const key = {
    gpt: "OPENAI_API_KEY",
    gemini: "GEMINI_API_KEY",
    claude: "ANTHROPIC_API_KEY",
  }[provider];

  if (!process.env[key]) throw new Error(`${key} is missing.`);
}

async function loadGenerator(provider) {
  const aiDir = process.env.AI_DIR || "../ai";
  const mapping = {
    gpt: ["generate-gpt-tweet.js", "generateGPTTweet"],
    gemini: ["generate-gemini-tweet.js", "generateGeminiTweet"],
    claude: ["generateClaudeTweet.js", "generateClaudeTweet"],
  };

  const [file, exportName] = mapping[provider];
  const modulePath = path.resolve(__dirname, aiDir, file);
  const module = await import(pathToFileURL(modulePath).href);
  const generator = module[exportName];

  if (typeof generator !== "function") {
    throw new Error(`${exportName} is not exported from ${modulePath}`);
  }

  return { generator, modulePath };
}

function getTweetText(result) {
  if (typeof result === "string") return result.trim();
  return result?.tweetText?.trim() || "";
}

async function main() {
  const [, , rawUrl, rawProvider = "claude"] = process.argv;
  if (!rawUrl || ["-h", "--help"].includes(rawUrl)) {
    printUsage();
    return;
  }

  const provider = rawProvider.toLowerCase();
  if (!SUPPORTED_PROVIDERS.has(provider)) {
    throw new Error("Provider must be gpt, gemini, or claude.");
  }

  assertApiKey(provider);
  const url = validateUrl(rawUrl);
  const parsed = await parseSKArticle(url);

  if (!parsed?.headline || !parsed?.body) {
    throw new Error("Could not extract the article headline/body.");
  }

  const articleText = `${parsed.headline}\n${parsed.body}`;
  const { generator, modulePath } = await loadGenerator(provider);
  const result = await generator(articleText);
  const tweet = getTweetText(result);

  if (!tweet) throw new Error("The selected generator returned no tweet.");

  console.log(`\nProvider  : ${provider}`);
  console.log(`Generator : ${modulePath}`);
  console.log(`Headline  : ${parsed.headline}`);
  console.log(`Paragraphs: ${parsed.paragraphCount}`);
  console.log("\n================ GENERATED TWEET ================\n");
  console.log(tweet);
  console.log("\n=================================================");
  console.log(`Characters: ${tweet.length}\n`);
}

main().catch((error) => {
  console.error("\nTest failed:", error?.message || error);
  process.exitCode = 1;
});
