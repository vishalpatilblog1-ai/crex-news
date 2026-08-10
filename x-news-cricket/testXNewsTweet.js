// x-news-cricket/testXNewsTweet.js
//
// Standalone test: fetches live cricket stories from X News Search and
// generates a tweet, without touching STATE, dedup, or the posting queue.
// Mirrors testSKTweet.js's manual-run pattern.
//
// Usage:
//   node x-news-cricket/testXNewsTweet.js [provider] [maxAgeHours]
//
// Providers: gpt | gemini | claude   (default: claude)
// maxAgeHours: default 1. Must be a whole integer — the API rejects
// decimals (e.g. 0.25) as "not a valid Int" despite one earlier manual
// curl accepting it. fetchXNewsCricket.js rounds up automatically, but
// pass whole numbers here to avoid relying on that.

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import "dotenv/config";

import { fetchXNewsCricket } from "./fetchXNewsCricket.js";
import { isBlockedXNewsHeadline, isCricketStory } from "./xNewsFilters.js";

const SUPPORTED_PROVIDERS = new Set(["gpt", "gemini", "claude"]);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function printUsage() {
  console.log(`
Usage:
  node x-news-cricket/testXNewsTweet.js [provider] [maxAgeHours]

Providers: gpt | gemini | claude (default: claude)
maxAgeHours: default 1 (use 0.25 for ~15min window)
AI_DIR defaults to ../ai and is resolved from this file.
`);
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
  const [, , rawProvider = "claude", rawMaxAgeHours = "1"] = process.argv;

  if (["-h", "--help"].includes(rawProvider)) {
    printUsage();
    return;
  }

  const provider = rawProvider.toLowerCase();
  if (!SUPPORTED_PROVIDERS.has(provider)) {
    throw new Error("Provider must be gpt, gemini, or claude.");
  }

  assertApiKey(provider);

  const maxAgeHours = Number(rawMaxAgeHours);
  const { candidates, failures } = await fetchXNewsCricket({
    maxAgeHours,
    maxResults: 5,
  });

  if (failures.length > 0) {
    console.log("Fetch failures:", failures);
  }

  const story = candidates.find(
    (c) => isCricketStory(c) && !isBlockedXNewsHeadline(c.headline),
  );

  if (!story) {
    throw new Error("No usable cricket story found in this window.");
  }

  const fullText = `${story.headline}\n${story.hook}\n${story.summary}`;
  const { generator, modulePath } = await loadGenerator(provider);
  const result = await generator(fullText);
  const tweet = getTweetText(result);

  if (!tweet) throw new Error("The selected generator returned no tweet.");

  console.log(`\nProvider   : ${provider}`);
  console.log(`Generator  : ${modulePath}`);
  console.log(`News ID    : ${story.newsId}`);
  console.log(`Headline   : ${story.headline}`);
  console.log(`Teams      : ${story.teams.join(", ") || "(none)"}`);
  console.log(`Updated at : ${story.updatedAt}`);
  console.log("\n================ SOURCE TEXT ================\n");
  console.log(fullText);
  console.log("\n================ GENERATED TWEET ================\n");
  console.log(tweet);
  console.log("\n=================================================");
  console.log(`Characters: ${tweet.length}\n`);
}

main().catch((error) => {
  console.error("\nTest failed:", error?.message || error);
  process.exitCode = 1;
});
