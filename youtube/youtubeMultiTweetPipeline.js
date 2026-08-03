// youtube/youtubeMultiTweetPipeline.js
//
// Takes recent YouTube videos from a channel, extracts up to 3 distinct
// newsworthy angles per video, generates one original tweet per angle
// (using your existing generateClaudeTweetWithType), checks each new
// tweet isn't a near-duplicate of one already posted (this run OR past
// runs, via persistent state), then enqueues each via your existing
// enqueueTweet/tweetQueue system -- actual posting timing/spacing to X
// is handled by your existing queue worker, not this script.
//
// TRANSCRIPT RETRY QUEUE
// -----------------------
// A video found while YouTube's auto-captions aren't ready yet used to
// just get silently dropped once it aged out of the `minutesBack`
// discovery window (e.g. a video found at 10 min old, still not
// transcribed by 25 min old, then invisible forever once it crosses the
// 30-min window on the next poll). Videos with no transcript yet are now
// tracked in global.STATE.pendingTranscriptVideos (persisted across
// restarts) and retried on every poll cycle -- independent of the
// discovery window -- until either a transcript becomes available or
// TRANSCRIPT_RETRY_CEILING_MS (default 4h) passes, at which point it's
// logged as abandoned and removed so the pending list doesn't grow
// unbounded.
//
// USAGE
// -----
//   node youtube/youtubeMultiTweetPipeline.js UCtB4Jl_0Nqkme13o7hyEMwg
//
// This is a TEST-MODE CLI entry point: it uses a wide 1440-min (24h)
// discovery window so you can always find something to test with. The
// recurring production poller (ytNewsPollingLoop.js) should call
// runMultiTweetPipeline() with a much narrower minutesBack (e.g. 30) --
// the retry queue is what protects against missing a video whose
// transcript simply wasn't ready within that narrow window.

import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
import {
  getRecentVideos,
  fetchTranscriptText,
  getVideoDurationMinutes,
  getVideoMetadata,
  looksLikeLivestreamTitle,
} from "./youtubeTranscriptFetcher.js";

// TODO: fix these import paths to match your actual project structure
// import { generateClaudeTweetWithType } from "../generateClaudeTweet.js";
import { loadState, saveState } from "../utils/stateStoreCloud.js";
import { applySourceSignature, enqueueTweet } from "../twitter/tweetQueue.js";
import { judgeNewsContext } from "../indian-express/ai/judgeNewsContext.js";

dotenv.config();

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MAX_ANGLES_PER_VIDEO = 2; // default/fallback cap when duration lookup fails
const LONG_VIDEO_MINUTES_THRESHOLD = 15; // videos >= this get the higher angle cap
const MAX_ANGLES_LONG_VIDEO = 3;
const DUPLICATE_SIMILARITY_THRESHOLD = 0.55; // see isDuplicate() below
const TRANSCRIPT_RETRY_CEILING_MS = 4 * 60 * 60 * 1000; // give up retrying a video's transcript after 4h
const DAILY_CONTEXT_RETENTION_MS = 6 * 60 * 60 * 1000; // matches CA's own retention -- keep both sources aging out on the same clock

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

Don't default only to news/tactical/selection angles. If the transcript contains
a genuine human-interest or personality moment -- a personal anecdote, an insider
story about a relationship between two named cricket figures, a gift/gesture, a
routine or habit, a behind-the-scenes detail -- treat that as an equally valid
angle, not a lesser one. A strong specific quote (named speaker, concrete detail)
is often a better angle than a generic analysis point, even if it's not the
"biggest" news in the video.

PUBLIC FIGURE CHECK: only build a standalone angle around a named person if the
TRANSCRIPT ITSELF establishes them as a public figure in a cricket context
(a player, coach, selector, official, journalist, or commentator -- their role
must be stated in the transcript, not assumed from general knowledge). If a
name is mentioned only in a private/personal context (e.g. introduced as "a
father," "a fan," "a parent," someone's family member, or any other non-public
role, with no public cricket role stated), do NOT build a standalone angle
around them. Either fold that detail into a related angle about an actual
public figure, or drop it entirely if it doesn't meaningfully support one.

For each angle, extract ONLY the portion of the transcript relevant to that
angle (translate to English, condense to the key claims -- who said what,
what's confirmed vs speculative, specific names/details). This extracted
summary will be used as the input article for a tweet-generation step, so
include enough concrete detail (names, specific claims, direct quotes if any)
for that step to work with -- but do not add any interpretation or analysis
of your own, just extract and summarize factually.

Do NOT over-compress named specifics or strong direct quotes at this stage --
other player names mentioned in the same breath, exact reasons given, and any
strong first-person quote should be preserved close to verbatim in the
summary. It's easier for the next step to trim detail than to recover detail
you dropped here.

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

// Prunes dailyContext.contexts entries older than DAILY_CONTEXT_RETENTION_MS.
// caNewsPollingLoop.js has its own equivalent pruning, but it only runs
// while CA's polling loop is actually enabled. This runs independently so
// aging-out still happens correctly whenever CA is paused/disabled (e.g.
// during YouTube-only testing windows) -- both sources share the same
// retention clock either way, since they read/write the same pool.
function pruneDailyContext(STATE) {
  if (!STATE.dailyContext?.contexts?.length) return 0;
  const cutoff = Date.now() - DAILY_CONTEXT_RETENTION_MS;
  const before = STATE.dailyContext.contexts.length;
  STATE.dailyContext.contexts = STATE.dailyContext.contexts.filter((c) => {
    const createdAtMs = new Date(c.createdAt).getTime();
    return !Number.isFinite(createdAtMs) || createdAtMs >= cutoff; // keep malformed entries rather than risk losing real ones on a bad parse
  });
  return before - STATE.dailyContext.contexts.length;
}

// ─────────────────────────────────────────────────────────────────────────
// STEP 3: Posting -- wired to your real tweet queue
// ─────────────────────────────────────────────────────────────────────────
async function postTweet(tweetText, { videoId, angleIndex, imageUrl = null }) {
  // enqueueTweet reads/writes global.STATE directly (not via loadState/saveState),
  // so it must already be initialized before this runs. runMultiTweetPipeline()
  // sets global.STATE once at the top -- see there.
  const tweetId = `youtube-${videoId}-angle-${angleIndex}`;
  const seenKey = `youtube-${videoId}-angle-${angleIndex}`; // same shape as your existing dedup keys elsewhere

  enqueueTweet({
    id: tweetId,
    source: "YT",
    text: tweetText,
    imageUrl,
    seenKey,
    // NOTE: intentionally Date.now() (enqueue time), NOT the video's real
    // YouTube upload time. tweetQueue's 60-min staleness check uses this
    // field to decide "is this tweet too old to post" -- for CricketAddictor
    // that correctly means "is the article too old," but for YouTube the
    // video may already be 20-40+ min old (or, with the retry queue, even
    // hours old) by the time transcript fetch + generation finish. Using
    // enqueue time instead measures "how long has this sat in the queue,"
    // which is what the check is actually meant to protect against.
    publishedAt: Date.now(),
  });

  console.log(
    `✅ Enqueued tweet ${tweetId} for real posting via your existing tweet queue.`,
  );
  return { success: true, tweetId };
}

// ─────────────────────────────────────────────────────────────────────────
// Process ONE video that has a ready transcript: extract angles, generate,
// dedup-check, post. This is the same logic that used to live inline in
// runMultiTweetPipeline -- factored out so it can be called for both
// freshly-discovered videos AND videos resolved from the retry queue.
// ─────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────
// STEP 0: Cricket-relevance filter
// ─────────────────────────────────────────────────────────────────────────
// Some channels (e.g. multi-sport outlets like Sports Tak) post cricket AND
// non-cricket content (Commonwealth Games boxing/judo/athletics, etc.). This
// is a cheap Haiku check on the title + a transcript snippet, run BEFORE
// angle extraction, so non-cricket videos are filtered out without wasting
// Sonnet calls generating tweets for them.
async function isCricketContent(title, transcriptText) {
  const snippet = transcriptText.slice(0, 1500); // title + opening is enough to tell the sport
  const prompt = `
Title: "${title}"
Transcript opening (may be Hindi/Hinglish): "${snippet}"

Is this video PRIMARILY about cricket? Answer with ONLY one word: YES or NO.
If the video covers multiple sports and cricket is not the main focus, answer NO.
`;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 10,
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
    });
    const textBlock = response.content.find((block) => block.type === "text");
    const answer = textBlock?.text?.trim().toUpperCase() || "";
    return answer.startsWith("YES");
  } catch (err) {
    console.warn(
      "⚠️ Cricket-relevance check failed, defaulting to allow (proceeding as cricket):",
      err?.message || err,
    );
    return true; // fail open -- don't silently drop a video just because this check errored
  }
}

async function processVideo(video, { maxAngles, articleType }) {
  console.log(`\n✅ Processing video: "${video.title}" (${video.videoId})`);
  console.log(`Transcript length: ${video.transcriptText.length} chars`);

  const isCricket = await isCricketContent(video.title, video.transcriptText);
  if (!isCricket) {
    console.log(
      `🏏🚫 Not cricket content, skipping permanently: "${video.title}"`,
    );
    global.STATE.videoAngleCache[video.videoId] = []; // empty cache = "checked, nothing to do" -- matches the allResolved short-circuit on future polls
    await saveState(
      global.STATE,
      `youtube-non-cricket-skipped-${video.videoId}`,
    );
    return 0;
  }

  // Track progress PER ANGLE, not just per video, so a crash/interrupt
  // mid-video resumes from the next un-posted angle instead of skipping
  // the whole video. Shape: { "<videoId>": [0, 1] } <- posted angle indices
  const videoAngleProgress = global.STATE.videoAngleProgress || {};
  const postedAngleIndices = new Set(videoAngleProgress[video.videoId] || []);
  const skippedAngleIndices = new Set(
    global.STATE.videoAngleSkipped[video.videoId] || [],
  );
  const recentPostedTweets = global.STATE.recentPostedTweets || [];

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
    // Long videos genuinely tend to hold more distinct newsworthy angles
    // (e.g. a 16-min insider video covering a trade rumor, a captaincy
    // situation, AND a fitness camp -- all real, all separate). Short
    // "flash update" videos (1-3 min) rarely have more than one or two.
    // Use YouTube's real duration rather than transcript length, since a
    // long silence-heavy video or a short but dense one can throw off a
    // character-count proxy.
    const durationMinutes = await getVideoDurationMinutes(video.videoId);
    const dynamicMaxAngles =
      durationMinutes !== null &&
      durationMinutes >= LONG_VIDEO_MINUTES_THRESHOLD
        ? MAX_ANGLES_LONG_VIDEO
        : maxAngles; // fall back to the caller's default (2) if duration lookup fails or video is short

    console.log(
      `⏱️ Video duration: ${durationMinutes !== null ? durationMinutes.toFixed(1) + " min" : "unknown"} — using max ${dynamicMaxAngles} angle(s)`,
    );

    console.log(`\n🔍 Extracting up to ${dynamicMaxAngles} distinct angles...`);
    angles = await extractAngles(video.transcriptText, dynamicMaxAngles);
    global.STATE.videoAngleCache[video.videoId] = angles;
    await saveState(global.STATE, `youtube-angles-extracted-${video.videoId}`);
  }

  if (angles.length === 0) {
    console.log("⚠️ No angles extracted. Nothing to tweet.");
    return 0;
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
    return 0;
  }

  console.log(`Found ${angles.length} angle(s):`);
  angles.forEach((a, i) => console.log(`  ${i + 1}. ${a.topic}`));

  // ── Generate + dedup-check + post, one angle at a time ──────────────────
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

    // ── Classify THIS angle individually (was: whole video hardcoded to
    // opinion_piece). Each angle's summary is its own distinct claim/story,
    // so it can genuinely land in a different type -- a quote-driven angle
    // should get press_conference's attribution handling, a squad angle
    // should get selection_news, etc. Falls back to the caller's default
    // (articleType, still "opinion_piece") if classification errors out.
    let angleArticleType = articleType;
    try {
      angleArticleType = await classifyArticle(angle.summary);
      console.log(`🏷️ Angle classified as: ${angleArticleType}`);
    } catch (err) {
      console.warn(
        `⚠️ classifyArticle failed for angle, falling back to "${articleType}":`,
        err?.message || err,
      );
    }

    let result = await generateClaudeTweetWithType(
      angle.summary,
      angleArticleType,
    );

    if (!result.tweetText) {
      console.log(
        "⚠️ Generation failed for this angle, skipping (will retry next poll -- not marked permanent).",
      );
      continue;
    }

    // 280 is where X folds a tweet behind "Show more" -- it is NOT a hard
    // post limit on an X Premium account (which GullyPoint runs on for the
    // monetization program). Retrying/trimming every time a tweet crossed
    // 280 was burning an extra Sonnet call on every longer tweet AND was
    // compressing away exactly the kind of strong, specific first-person
    // quote that performs best (see the competitor-account quote-spotlight
    // analysis). So: post as-is up to MAX_TWEET_CHARS, only skip past that
    // real ceiling, and never retry purely for length.
    const MAX_TWEET_CHARS = Number(process.env.MAX_TWEET_CHARS) || 4000;

    if (result.tweetText.length > MAX_TWEET_CHARS) {
      console.log(
        `⚠️ Tweet is ${result.tweetText.length} chars -- exceeds MAX_TWEET_CHARS (${MAX_TWEET_CHARS}). Skipping this angle.`,
      );
      await markAngleSkipped(i, `over ${MAX_TWEET_CHARS} chars`);
      continue;
    }

    if (result.tweetText.length > 280) {
      console.log(
        `📏 Tweet is ${result.tweetText.length} chars -- over the 280 "Show more" fold point. Posting as-is (no retry).`,
      );
    }

    console.log(
      `Generated tweet (${result.tweetText.length} chars):\n${result.tweetText}`,
    );

    const allExistingTweets = [...postedThisRun, ...recentPostedTweets];
    if (isDuplicate(result.tweetText, allExistingTweets)) {
      console.log("🚫 Skipping this tweet -- too similar to an existing one.");
      await markAngleSkipped(i, "similar to an already-posted tweet");
      continue;
    }

    // ── Generate card image if this angle's type supports one ──────────────
    let generatedImagePath = null;
    if (result.card) {
      try {
        generatedImagePath = await generateCardImage(
          CREX_BASE_IMAGE_TEMPLATE,
          result.card,
        );
        console.log("🃏 YouTube card generated:", generatedImagePath);
      } catch (err) {
        console.error("❌ Card image generation failed:", err);
      }
    } else {
      console.log("📝 Text-only tweet (no card for this article type)");
    }

    // ── Post it ──────────────────────────────────────────────────────────
    await postTweet(result.tweetText, {
      videoId: video.videoId,
      angleIndex: i,
      imageUrl: generatedImagePath || null,
    });

    tweetText = applySourceSignature(result.tweetText, "YT");
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
    // Save global.STATE as a whole -- enqueueTweet already mutated
    // global.STATE.tweetQueue directly, so saving a stale local copy here
    // would silently drop that queue update.
    postedAngleIndices.add(i);
    global.STATE.videoAngleProgress = {
      ...(global.STATE.videoAngleProgress || {}),
      [video.videoId]: [...postedAngleIndices],
    };
    global.STATE.recentPostedTweets = [
      ...recentPostedTweets,
      ...postedThisRun,
    ].slice(-50); // keep last 50
    await saveState(global.STATE, `youtube-multi-tweet-angle-${i + 1}-posted`);
  }

  console.log(
    `\n✅ Pipeline complete. Posted ${postedThisRun.length}/${angles.length} tweets for this video.`,
  );
  return postedThisRun.length;
}

// ─────────────────────────────────────────────────────────────────────────
// MAIN ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────
export async function runMultiTweetPipeline(channelId, options = {}) {
  const {
    minutesBack = 1440, // 24h default for CLI test mode; the recurring poller should pass ~30
    maxAngles = MAX_ANGLES_PER_VIDEO,
    articleType = "opinion_piece", // FALLBACK ONLY -- each angle is now classified individually via classifyArticle(); this is just what's used if that classification call errors out
  } = options;

  // ── Load persistent state ───────────────────────────────────────────────
  // enqueueTweet() (from tweetQueue.js) reads/writes global.STATE directly,
  // not via loadState/saveState -- so we must set global.STATE before any
  // postTweet() call happens.
  const state = await loadState();
  global.STATE = state;
  global.STATE.dailyContext ??= { contexts: [] }; // shared cross-source dedup pool with CricketAddictor
  global.STATE.videoAngleCache ??= {}; // caches extracted angles per video so re-polling doesn't re-extract with different phrasing/order
  global.STATE.videoAngleSkipped ??= {}; // { videoId: [indices] } permanently skipped (length-failed or duplicate) -- never retried
  global.STATE.videoAngleProgress ??= {}; // { videoId: [indices] } posted angle indices
  global.STATE.recentPostedTweets ??= [];
  // { videoId: { channelId, title, publishedAt, firstSeenAt, lastAttemptAt, attempts } }
  // Videos found with no transcript yet, retried every poll independent of
  // the minutesBack discovery window, until ready or TRANSCRIPT_RETRY_CEILING_MS passes.
  global.STATE.pendingTranscriptVideos ??= {};

  const prunedCount = pruneDailyContext(global.STATE);
  if (prunedCount > 0) {
    console.log(
      `🧹 Pruned ${prunedCount} stale dailyContext entr${prunedCount === 1 ? "y" : "ies"} (older than ${DAILY_CONTEXT_RETENTION_MS / 1000 / 60 / 60}h)`,
    );
    await saveState(global.STATE, "youtube-daily-context-pruned");
  }

  // ── Step 1: discover fresh videos in the normal lookback window ────────
  console.log(
    `\n📺 Fetching recent videos from channel ${channelId} (last ${minutesBack} min)...`,
  );
  let freshVideos = [];
  try {
    freshVideos = await getRecentVideos({
      channelId,
      minutesBack,
      maxVideos: 5,
    });
  } catch (err) {
    console.error(
      `❌ Failed to fetch recent videos for channel ${channelId}:`,
      err?.message || err,
    );
  }

  // ── Step 2: gather videos still pending transcript retry for this channel ──
  const now = Date.now();
  const pendingForChannel = Object.entries(global.STATE.pendingTranscriptVideos)
    .filter(([, p]) => p.channelId === channelId)
    .map(([videoId, p]) => ({ videoId, ...p }));

  // Give up on anything past the retry ceiling, log it clearly so a missed
  // scoop is visible in logs rather than silently vanishing.
  for (const pending of pendingForChannel) {
    const age = now - pending.firstSeenAt;

    // Retroactive cleanup: a livestream VOD queued before this filter existed
    // shouldn't have to wait out the full ceiling -- clear it immediately.
    if (looksLikeLivestreamTitle(pending.title)) {
      console.log(
        `🔴📺 Clearing previously-queued livestream VOD from pending retry: "${pending.title}" (${pending.videoId})`,
      );
      delete global.STATE.pendingTranscriptVideos[pending.videoId];
      global.STATE.videoAngleCache[pending.videoId] = []; // mark resolved so it's never revisited
      continue;
    }

    if (age > TRANSCRIPT_RETRY_CEILING_MS) {
      console.log(
        `🗑️ Giving up on transcript for "${pending.title}" (${pending.videoId}) — no captions after ${(age / 1000 / 60).toFixed(0)} min (ceiling: ${TRANSCRIPT_RETRY_CEILING_MS / 1000 / 60}min). Abandoning.`,
      );
      delete global.STATE.pendingTranscriptVideos[pending.videoId];
    }
  }
  await saveState(global.STATE, "youtube-pending-transcript-pruned");

  // Re-read after pruning
  const stillPendingForChannel = Object.entries(
    global.STATE.pendingTranscriptVideos,
  )
    .filter(([, p]) => p.channelId === channelId)
    .map(([videoId, p]) => ({ videoId, ...p }));

  // ── Step 3: merge fresh + pending candidates, deduped by videoId ───────
  const candidatesById = new Map();
  for (const v of freshVideos) {
    candidatesById.set(v.videoId, {
      videoId: v.videoId,
      title: v.title,
      publishedAt: v.publishedAt,
    });
  }
  for (const p of stillPendingForChannel) {
    if (!candidatesById.has(p.videoId)) {
      candidatesById.set(p.videoId, {
        videoId: p.videoId,
        title: p.title,
        publishedAt: p.publishedAt,
      });
    }
  }

  if (candidatesById.size === 0) {
    console.log(
      `No videos found in the last ${minutesBack} minutes, and nothing pending retry.`,
    );
    return;
  }

  // ── Step 4: for each candidate, try transcript; process if ready, else
  // add/update the pending retry entry ────────────────────────────────────
  let totalPosted = 0;

  for (const candidate of candidatesById.values()) {
    // Already fully resolved from a past run? Skip transcript fetch entirely.
    const alreadyPosted = new Set(
      global.STATE.videoAngleProgress[candidate.videoId] || [],
    );
    const alreadySkipped = new Set(
      global.STATE.videoAngleSkipped[candidate.videoId] || [],
    );
    const cachedAngles = global.STATE.videoAngleCache[candidate.videoId];
    if (
      cachedAngles &&
      cachedAngles.every(
        (_, i) => alreadyPosted.has(i) || alreadySkipped.has(i),
      )
    ) {
      console.log(
        `✅ Video ${candidate.videoId} already fully resolved. Skipping.`,
      );
      delete global.STATE.pendingTranscriptVideos[candidate.videoId]; // clean up if it was pending
      continue;
    }

    // ── Livestream filter ─────────────────────────────────────────────────
    // Livestream VODs (e.g. "LIVE | Welsh Fire vs ...") often never get
    // auto-captions the way normal uploads do, or take FAR longer. Without
    // this check, these were entering the transcript-retry queue and
    // burning through the full 4h ceiling every single time before finally
    // giving up -- wasted poll cycles for videos that were never going to
    // yield a transcript. Filtered here, before ever attempting a
    // transcript fetch or entering the pending queue.
    if (looksLikeLivestreamTitle(candidate.title)) {
      console.log(
        `🔴📺 Skipping likely livestream VOD (title pattern): "${candidate.title}" (${candidate.videoId})`,
      );
      delete global.STATE.pendingTranscriptVideos[candidate.videoId]; // clean up if a past run already queued it
      global.STATE.videoAngleCache[candidate.videoId] = []; // mark resolved so it's never revisited
      await saveState(
        global.STATE,
        `youtube-livestream-skipped-${candidate.videoId}`,
      );
      continue;
    }

    // Belt-and-suspenders: also check the real live-broadcast status via
    // API for videos that don't match the title pattern but ARE currently
    // live or scheduled (upcoming) -- these definitely have no transcript yet.
    const { liveBroadcastContent } = await getVideoMetadata(candidate.videoId);
    if (
      liveBroadcastContent === "live" ||
      liveBroadcastContent === "upcoming"
    ) {
      console.log(
        `🔴📺 Skipping (currently ${liveBroadcastContent}, no transcript possible yet): "${candidate.title}" (${candidate.videoId})`,
      );
      // NOT marked permanently resolved -- an "upcoming" stream will genuinely
      // have real content once it airs and ends, so leave it to be
      // re-evaluated on a future poll rather than caching it as empty forever.
      continue;
    }

    const transcriptText = await fetchTranscriptText(candidate.videoId);

    if (!transcriptText) {
      const existing = global.STATE.pendingTranscriptVideos[candidate.videoId];
      global.STATE.pendingTranscriptVideos[candidate.videoId] = {
        channelId,
        title: candidate.title,
        publishedAt: candidate.publishedAt,
        firstSeenAt: existing?.firstSeenAt ?? now,
        lastAttemptAt: now,
        attempts: (existing?.attempts ?? 0) + 1,
      };
      await saveState(
        global.STATE,
        `youtube-transcript-not-ready-${candidate.videoId}`,
      );
      console.log(
        `⏳ Transcript not ready yet for "${candidate.title}" (${candidate.videoId}) — attempt ${global.STATE.pendingTranscriptVideos[candidate.videoId].attempts}, will retry next poll.`,
      );
      continue;
    }

    // Transcript is ready -- resolve out of the pending queue and process.
    delete global.STATE.pendingTranscriptVideos[candidate.videoId];
    await saveState(
      global.STATE,
      `youtube-transcript-ready-${candidate.videoId}`,
    );

    const video = {
      videoId: candidate.videoId,
      title: candidate.title,
      publishedAt: candidate.publishedAt,
      transcriptText,
    };
    const posted = await processVideo(video, { maxAngles, articleType });
    totalPosted += posted;
  }

  if (totalPosted === 0 && candidatesById.size > 0) {
    console.log(
      `\n(No new tweets posted this cycle for channel ${channelId} -- see per-video logs above.)`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────
// CLI entry point for manual testing
// ─────────────────────────────────────────────────────────────────────────
import { fileURLToPath } from "url";
import {
  classifyArticle,
  generateClaudeTweetWithType,
} from "../ai/generateClaudeTweet.js";
import { generateCardImage } from "../canvas/imageRenderer.js";
import { CREX_BASE_IMAGE_TEMPLATE } from "../utils/config.js";
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  const channelId = process.argv[2];

  if (!channelId) {
    console.log("Usage: node youtube/youtubeMultiTweetPipeline.js <channelId>");
    process.exit(1);
  }

  runMultiTweetPipeline(channelId, {
    minutesBack: 1440,
    maxAngles: 2,
  }).catch((err) => {
    console.error("❌ Pipeline failed:", err);
    process.exit(1);
  });
}
