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

// node cricket-addictor/testCATweet.js "https://cricketaddictor.com/cricket-news/bcci-yet-to-hold-uk-tour-review-meeting-gautam-gambhir-likely-to-join-online-report-462194/" gemini
// node cricket-addictor/testCATweet.js "https://cricketaddictor.com/cricket-news/bcci-yet-to-hold-uk-tour-review-meeting-gautam-gambhir-likely-to-join-online-report-462194/" gpt
// node cricket-addictor/testCATweet.js "https://cricketaddictor.com/cricket-news/bcci-yet-to-hold-uk-tour-review-meeting-gautam-gambhir-likely-to-join-online-report-462194/" claude

// node cricket-addictor/testCATweet.js "https://cricketaddictor.com/cricket-news/bcci-selectors-fear-india-will-lose-2027-world-cup-if-rohit-sharma-plays-report-462193/#google_vignette" gemini
// node cricket-addictor/testCATweet.js "https://cricketaddictor.com/cricket-news/bcci-selectors-fear-india-will-lose-2027-world-cup-if-rohit-sharma-plays-report-462193/#google_vignette" gpt
// node cricket-addictor/testCATweet.js "https://cricketaddictor.com/cricket-news/bcci-selectors-fear-india-will-lose-2027-world-cup-if-rohit-sharma-plays-report-462193/#google_vignette" claude

// node cricket-addictor/testCATweet.js "https://cricketaddictor.com/cricket-news/shubman-gills-india-train-under-unprecedented-security-in-colombo-fans-barred-462200/" gemini
// node cricket-addictor/testCATweet.js "https://cricketaddictor.com/cricket-news/shubman-gills-india-train-under-unprecedented-security-in-colombo-fans-barred-462200/" gpt
// node cricket-addictor/testCATweet.js "https://cricketaddictor.com/cricket-news/shubman-gills-india-train-under-unprecedented-security-in-colombo-fans-barred-462200/" claude

// node cricket-addictor/testCATweet.js "https://cricketaddictor.com/cricket-news/mohammad-amir-in-ipl-2027-the-truth-after-his-british-citizenship-462201/" gemini
// node cricket-addictor/testCATweet.js "https://cricketaddictor.com/cricket-news/mohammad-amir-in-ipl-2027-the-truth-after-his-british-citizenship-462201/" gpt
// node cricket-addictor/testCATweet.js "https://cricketaddictor.com/cricket-news/mohammad-amir-in-ipl-2027-the-truth-after-his-british-citizenship-462201/" claude

// node cricket-addictor/testCATweet.js "https://cricketaddictor.com/cricket-news/vvs-laxman-in-contention-to-replace-ajit-agarkar-as-bcci-chief-selector-report-462192/" gemini
// node cricket-addictor/testCATweet.js "https://cricketaddictor.com/cricket-news/vvs-laxman-in-contention-to-replace-ajit-agarkar-as-bcci-chief-selector-report-462192/" gpt
// node cricket-addictor/testCATweet.js "https://cricketaddictor.com/cricket-news/vvs-laxman-in-contention-to-replace-ajit-agarkar-as-bcci-chief-selector-report-462192/" claude

// node cricket-addictor/testCATweet.js "https://cricketaddictor.com/cricket-news/im-not-too-fussed-former-england-pacer-questions-stephen-flemings-appointment-as-new-head-coach-462180/" claude
// node cricket-addictor/testCATweet.js "https://cricketaddictor.com/cricket-news/sunil-gavaskar-reveals-what-indian-cricket-got-wrong-with-ajinkya-rahane-462175/" claude
// node cricket-addictor/testCATweet.js "https://cricketaddictor.com/cricket-news/ben-stokes-rules-out-2027-ashes-comeback-says-playing-without-captaincy-was-impossible-462171/" claude
