// youtube/youtubeMultiTweetPipeline.js
//
// Takes ONE long YouTube video transcript, extracts up to 3 distinct
// newsworthy angles, generates one original tweet per angle (using
// your existing generateClaudeTweetWithType), checks each new tweet
// isn't a near-duplicate of one already posted (this run OR past runs,
// via persistent state), then enqueues each via your existing
// enqueueTweet/tweetQueue system -- actual posting timing/spacing to X
// is handled by your existing queue worker, not this script.
//
// USAGE
// -----
//   node youtube/youtubeMultiTweetPipeline.js UCtB4Jl_0Nqkme13o7hyEMwg
//
// This is a TEST-MODE script: it fetches the most recent video from
// the given channel (any recency window, since you're actively testing,
// not gated by your normal polling cadence), extracts angles, generates
// tweets, and enqueues them for posting via your real tweet queue.

import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
import { getRecentTranscripts } from "./youtubeTranscriptFetcher.js";

// TODO: fix these import paths to match your actual project structure
// import { generateClaudeTweetWithType } from "../generateClaudeTweet.js";
import { loadState, saveState } from "../utils/stateStoreCloud.js";
import { enqueueTweet } from "../twitter/tweetQueue.js";
import { judgeNewsContext } from "../indian-express/ai/judgeNewsContext.js";

dotenv.config();

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MAX_ANGLES_PER_VIDEO = 3;
const DUPLICATE_SIMILARITY_THRESHOLD = 0.55; // see isDuplicate() below

// ─────────────────────────────────────────────────────────────────────────
// STEP 1: Extract distinct newsworthy angles from a long transcript
// ─────────────────────────────────────────────────────────────────────────
// Uses Haiku (cheap) to identify up to N genuinely separate story angles
// in one transcript, so we don't just re-run the same generation prompt
// 3 times on the same text and get near-identical tweets back.
async function extractAngles(transcriptText, maxAngles = MAX_ANGLES_PER_VIDEO) {
  const prompt = `
This is a transcript of a cricket YouTube video (may contain Hindi/Hinglish).

Identify up to ${maxAngles} DISTINCT newsworthy angles/topics discussed in this
transcript that could each independently support a separate tweet. Each angle
must be substantively different from the others -- not the same story rephrased.

For each angle, extract ONLY the portion of the transcript relevant to that
angle (translate to English, condense to the key claims -- who said what,
what's confirmed vs speculative, specific names/details). This extracted
summary will be used as the input article for a tweet-generation step, so
include enough concrete detail (names, specific claims, direct quotes if any)
for that step to work with -- but do not add any interpretation or analysis
of your own, just extract and summarize factually.

If the transcript only really contains ONE distinct angle worth tweeting,
return just one. Do not manufacture angles that aren't genuinely there.

Return ONLY valid JSON, no explanation, no markdown code fences, in this exact format:
{
  "angles": [
    { "topic": "short label for this angle", "summary": "condensed English summary of this angle's content, 150-400 words" }
  ]
}

TRANSCRIPT:
${transcriptText}
`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2000,
    temperature: 0,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  const rawText = textBlock?.text?.trim() || "{}";

  try {
    // Strip potential markdown fences just in case the model adds them
    const cleaned = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "");
    const parsed = JSON.parse(cleaned);
    return (parsed.angles || []).slice(0, maxAngles);
  } catch (err) {
    console.warn("⚠️ Failed to parse angle extraction JSON:", rawText);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────
// STEP 2: Dedup check -- word-overlap similarity between tweet texts
// ─────────────────────────────────────────────────────────────────────────
// Simple, dependency-free Jaccard similarity on word sets. Not fancy, but
// effective for catching "these two tweets are basically saying the same
// thing" even if wording differs slightly. Threshold is tunable.
function normalizeForComparison(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2); // drop tiny filler words
}

function jaccardSimilarity(textA, textB) {
  const setA = new Set(normalizeForComparison(textA));
  const setB = new Set(normalizeForComparison(textB));
  const intersection = new Set([...setA].filter((w) => setB.has(w)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

function isDuplicate(candidateTweet, existingTweets) {
  return existingTweets.some((existing) => {
    const similarity = jaccardSimilarity(candidateTweet, existing);
    if (similarity >= DUPLICATE_SIMILARITY_THRESHOLD) {
      console.warn(
        `⚠️ Duplicate detected (similarity: ${(similarity * 100).toFixed(0)}%) against: "${existing.slice(0, 80)}..."`,
      );
      return true;
    }
    return false;
  });
}

// ─────────────────────────────────────────────────────────────────────────
// STEP 2b: Cross-source context dedup (shared with CricketAddictor)
// ─────────────────────────────────────────────────────────────────────────
// STATE.dailyContext.contexts is the SAME pool caNewsPollingLoop.js reads
// from and writes to -- it's source-agnostic. Checking against it here (and
// pushing our own summaries into it) means YouTube and CricketAddictor now
// dedupe against EACH OTHER's already-covered stories, not just themselves.
function normalizeSummary(text = "") {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function contextExists(STATE, summary) {
  if (!STATE.dailyContext?.contexts?.length) return false;
  const norm = normalizeSummary(summary);
  return STATE.dailyContext.contexts.some(
    (c) => normalizeSummary(c.summary) === norm,
  );
}

// ─────────────────────────────────────────────────────────────────────────
// STEP 3: Posting -- TODO: wire this to your actual X posting function
// ─────────────────────────────────────────────────────────────────────────
async function postTweet(tweetText, { videoId, angleIndex, publishedAt }) {
  // enqueueTweet reads/writes global.STATE directly (not via loadState/saveState),
  // so it must already be initialized before this runs. runMultiTweetPipeline()
  // sets global.STATE once at the top -- see there.
  const tweetId = `youtube-${videoId}-angle-${angleIndex}`;
  const seenKey = `youtube-${videoId}-angle-${angleIndex}`; // same shape as your existing dedup keys elsewhere

  enqueueTweet({
    id: tweetId,
    source: "YT",
    text: tweetText,
    imageUrl: null,
    seenKey,
    publishedAt: publishedAt ? new Date(publishedAt).getTime() : Date.now(),
  });

  console.log(
    `✅ Enqueued tweet ${tweetId} for real posting via your existing tweet queue.`,
  );
  return { success: true, tweetId };
}

// ─────────────────────────────────────────────────────────────────────────
// MAIN PIPELINE
// ─────────────────────────────────────────────────────────────────────────
export async function runMultiTweetPipeline(channelId, options = {}) {
  const {
    minutesBack = 1440, // 24h default for test mode, wide enough to always find something
    maxAngles = MAX_ANGLES_PER_VIDEO,
    articleType = "opinion_piece", // matches classification we reasoned through for insider/analyst videos
  } = options;

  console.log(`\n📺 Fetching recent video from channel ${channelId}...`);
  const videos = await getRecentTranscripts({
    channelId,
    minutesBack,
    maxVideos: 1,
  });

  if (videos.length === 0) {
    console.log(`No videos found in the last ${minutesBack} minutes.`);
    return;
  }

  const video = videos[0];
  console.log(`\n✅ Found video: "${video.title}" (${video.videoId})`);

  if (!video.transcriptText) {
    console.log(
      "⚠️ Transcript not available yet for this video. Try again shortly.",
    );
    return;
  }

  console.log(`Transcript length: ${video.transcriptText.length} chars`);

  // ── Load persistent state for cross-run dedup ──────────────────────────
  // enqueueTweet() (from tweetQueue.js) reads/writes global.STATE directly,
  // not via loadState/saveState -- so we must set global.STATE before any
  // postTweet() call happens, or enqueueTweet crashes reading .tweetQueue
  // off undefined. Your main index.js presumably does this same
  // `global.STATE = await loadState()` step at bootstrap; this script needs
  // to do it too since it runs standalone, outside that bootstrap.
  const state = await loadState();
  global.STATE = state;
  global.STATE.dailyContext ??= { contexts: [] }; // shared cross-source dedup pool with CricketAddictor
  global.STATE.videoAngleCache ??= {}; // caches extracted angles per video so re-polling doesn't re-extract with different phrasing/order each time
  global.STATE.videoAngleSkipped ??= {}; // { videoId: [indices] } permanently skipped (length-failed or duplicate) -- never retried
  // Track progress PER ANGLE, not just per video, so a crash/interrupt mid-video
  // resumes from the next un-posted angle instead of skipping the whole video.
  // Shape: { "<videoId>": [0, 1] }  <- angle indices already posted for that video
  const videoAngleProgress = state.videoAngleProgress || {};
  const postedAngleIndices = new Set(videoAngleProgress[video.videoId] || []);
  const skippedAngleIndices = new Set(
    global.STATE.videoAngleSkipped[video.videoId] || [],
  );
  const recentPostedTweets = state.recentPostedTweets || []; // array of tweet text strings, most recent N kept

  if (postedAngleIndices.size > 0) {
    console.log(
      `↻ Resuming video ${video.videoId} — angle(s) already posted: [${[...postedAngleIndices].join(", ")}]`,
    );
  }

  // ── Extract distinct angles (cached per video) ──────────────────────────
  let angles = global.STATE.videoAngleCache[video.videoId];

  if (angles) {
    console.log(
      `📋 Using cached angles for ${video.videoId} (extracted once, reused across polls)`,
    );
  } else {
    console.log(`\n🔍 Extracting up to ${maxAngles} distinct angles...`);
    angles = await extractAngles(video.transcriptText, maxAngles);
    global.STATE.videoAngleCache[video.videoId] = angles;
    await saveState(global.STATE, `youtube-angles-extracted-${video.videoId}`);
  }

  if (angles.length === 0) {
    console.log("⚠️ No angles extracted. Nothing to tweet.");
    return;
  }

  // ── Early exit: if every cached angle is already resolved (posted OR
  // permanently skipped), this video is fully done -- don't touch it again.
  const allResolved = angles.every(
    (_, i) => postedAngleIndices.has(i) || skippedAngleIndices.has(i),
  );
  if (allResolved) {
    console.log(
      `✅ Video ${video.videoId} fully resolved (all ${angles.length} angles posted or skipped). Nothing to do.`,
    );
    return;
  }

  console.log(`Found ${angles.length} angle(s):`);
  angles.forEach((a, i) => console.log(`  ${i + 1}. ${a.topic}`));

  // ── Generate + dedup-check + post, one angle at a time, spaced out ─────
  const postedThisRun = [];

  async function markAngleSkipped(index, reason) {
    skippedAngleIndices.add(index);
    global.STATE.videoAngleSkipped[video.videoId] = [...skippedAngleIndices];
    await saveState(
      global.STATE,
      `youtube-angle-${index + 1}-permanently-skipped: ${reason}`,
    );
  }

  for (let i = 0; i < angles.length; i++) {
    if (postedAngleIndices.has(i)) {
      console.log(
        `\n--- Angle ${i + 1}/${angles.length}: already posted in a previous run, skipping ---`,
      );
      continue;
    }
    if (skippedAngleIndices.has(i)) {
      console.log(
        `\n--- Angle ${i + 1}/${angles.length}: permanently skipped in a previous run (length/dedup), skipping ---`,
      );
      continue;
    }

    const angle = angles[i];
    console.log(`\n--- Angle ${i + 1}/${angles.length}: ${angle.topic} ---`);

    // ── Cross-source context check (shared with CricketAddictor) ─────────
    // Same judgeNewsContext call CA uses, against the SAME dailyContext pool.
    // If CricketAddictor (or another YouTube channel) already covered this
    // exact story today with high confidence, skip generating for it here.
    let contextDecision = null;
    try {
      contextDecision = await judgeNewsContext({
        articleText: angle.summary,
        existingContexts: global.STATE.dailyContext.contexts.map(
          (c) => c.summary,
        ),
      });

      console.log(
        `📊 Scores — significance: ${contextDecision?.significanceScore ?? "n/a"}, virality: ${contextDecision?.viralityScore ?? "n/a"} — "${angle.topic}"`,
      );

      if (
        contextDecision?.isAlreadyCovered &&
        contextDecision?.confidence >= 0.8
      ) {
        console.log(
          "🔴 Skipped — already covered by another source today (cross-source dedup)",
        );
        await markAngleSkipped(i, "cross-source dedup");
        continue;
      }
    } catch (err) {
      console.warn(
        "⚠️ judgeNewsContext failed, proceeding without cross-source check:",
        err?.message || err,
      );
    }

    let result = await generateClaudeTweetWithType(angle.summary, articleType);

    if (!result.tweetText) {
      console.log("⚠️ Generation failed for this angle, skipping.");
      continue;
    }

    // X's real hard limit is 280 chars (non-Premium). opinion_piece isn't in
    // the prompt's explicit Target length list, so Sonnet has no ceiling for
    // it and can overrun -- retry once with an explicit trim instruction
    // rather than posting something that would fail on the real API.
    if (result.tweetText.length > 280) {
      console.log(
        `⚠️ Tweet is ${result.tweetText.length} chars (over 280 limit). Retrying with a trim instruction...`,
      );
      const trimmedInput = `${angle.summary}\n\nSTRICT CONSTRAINT: the tweet you generate MUST be under 280 characters total. Compress to the single sharpest point -- cut supporting detail before cutting the verdict.`;
      const retryResult = await generateClaudeTweetWithType(
        trimmedInput,
        articleType,
      );
      if (retryResult.tweetText && retryResult.tweetText.length <= 280) {
        result = retryResult;
        console.log(`✅ Retry succeeded: ${result.tweetText.length} chars`);
      } else {
        console.log(
          `⚠️ Retry still over limit (${retryResult.tweetText?.length ?? "N/A"} chars). Skipping this angle rather than posting an invalid tweet.`,
        );
        await markAngleSkipped(i, "over 280 chars after retry");
        continue;
      }
    }

    console.log(
      `Generated tweet (${result.tweetText.length} chars):\n${result.tweetText}`,
    );

    // Check against BOTH this run's tweets so far AND past run history
    const allExistingTweets = [...postedThisRun, ...recentPostedTweets];
    if (isDuplicate(result.tweetText, allExistingTweets)) {
      console.log("🚫 Skipping this tweet -- too similar to an existing one.");
      await markAngleSkipped(i, "similar to an already-posted tweet");
      continue;
    }

    // ── Post it ──────────────────────────────────────────────────────────
    // NOTE: publishedAt here is intentionally Date.now() (enqueue time), NOT
    // video.publishedAt (the video's real YouTube upload time). tweetQueue's
    // 60-min staleness check uses this field to decide "is this tweet too
    // old to post" -- for CA that correctly means "is the article too old,"
    // but for YouTube the video may already be 20-40+ min old by the time
    // transcript fetch + angle extraction + generation finish, leaving little
    // buffer before the 60-min cutoff. Using enqueue time instead measures
    // "how long has this sat in the queue," which is what the check is
    // actually meant to protect against.
    await postTweet(result.tweetText, {
      videoId: video.videoId,
      angleIndex: i,
      publishedAt: Date.now(),
    });
    postedThisRun.push(result.tweetText);

    // Feed this story into the SHARED dailyContext pool so CricketAddictor
    // (or another YouTube channel) skips it too if it comes up again today.
    if (
      contextDecision?.newContext &&
      !contextExists(global.STATE, contextDecision.newContext)
    ) {
      global.STATE.dailyContext.contexts.push({
        summary: contextDecision.newContext,
        source: "YT",
        link: `youtube:${video.videoId}:angle:${i}`,
        createdAt: new Date().toISOString(),
      });
    }

    // ── Save state after EVERY successful post, not just at the end ────
    // (so a crash mid-run doesn't lose dedup history for tweets already posted)
    // Save global.STATE as a whole -- enqueueTweet already mutated
    // global.STATE.tweetQueue directly, so saving the old local `state`
    // object here would silently drop that queue update.
    postedAngleIndices.add(i);
    const updatedRecentTweets = [...recentPostedTweets, ...postedThisRun].slice(
      -50,
    ); // keep last 50
    global.STATE.videoAngleProgress = {
      ...(global.STATE.videoAngleProgress || {}),
      [video.videoId]: [...postedAngleIndices],
    };
    global.STATE.recentPostedTweets = updatedRecentTweets;
    await saveState(global.STATE, `youtube-multi-tweet-angle-${i + 1}-posted`);

    // No sleep/gap here anymore -- enqueueTweet just adds to your existing
    // posting queue, and the separate queue worker controls actual posting
    // timing/spacing to X. This script's job ends at "enqueued successfully."
  }

  console.log(
    `\n✅ Pipeline complete. Posted ${postedThisRun.length}/${angles.length} tweets for this video.`,
  );
}

// ─────────────────────────────────────────────────────────────────────────
// CLI entry point for manual testing
// ─────────────────────────────────────────────────────────────────────────
import { fileURLToPath } from "url";
import { generateClaudeTweetWithType } from "../ai/generateClaudeTweet.js";
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  const channelId = process.argv[2];

  if (!channelId) {
    console.log("Usage: node youtube/youtubeMultiTweetPipeline.js <channelId>");
    process.exit(1);
  }

  runMultiTweetPipeline(channelId, {
    minutesBack: 1440,
    maxAngles: 3,
  }).catch((err) => {
    console.error("❌ Pipeline failed:", err);
    process.exit(1);
  });
}
