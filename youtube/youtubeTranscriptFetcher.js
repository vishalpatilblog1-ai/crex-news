// youtube/youtubeTranscriptFetcher.js
//
// GullyPoint / crex-news pipeline module: monitors a YouTube channel
// for new uploads and fetches transcripts of recent videos, ready to
// feed into the eligibility-check + value-add tweet generation prompt.
//
// SETUP
// -----
// npm install youtube-transcript axios
//
// You need a YouTube Data API v3 key (free tier, no OAuth needed for
// public channel/video listing):
//   1. Go to https://console.cloud.google.com/
//   2. Create/select a project -> Enable "YouTube Data API v3"
//   3. Create credentials -> API key -> restrict to YouTube Data API v3
//   4. Set it as an env var: YOUTUBE_API_KEY=your_key_here (in .env
//      locally and in Railway env vars for this service)
//
// Free quota is 10,000 units/day. Each channel-check (playlistItems.list)
// costs 1 unit -- polling one channel every 5 min all day costs ~288
// units, effectively free. We deliberately avoid search.list (100
// units/call) by using the channel's hidden "uploads" playlist instead.
// Transcript fetching itself uses NO API quota -- the youtube-transcript
// package scrapes public caption data directly, no key needed for that part.
//
// USAGE
// -----
//   import { getRecentTranscripts } from './youtube/youtubeTranscriptFetcher.js';
//
//   const results = await getRecentTranscripts({
//     channelId: 'UCxxxxxxxxxxxxxxxxxxxxxx',
//     minutesBack: 240,   // e.g. look back 4 hours
//     maxVideos: 5,
//   });
//
//   for (const video of results) {
//     console.log(video.title, video.videoId, video.publishedAt);
//     console.log(video.transcriptText?.slice(0, 500));
//   }
//
// Or run this file directly for a quick manual test:
//   node youtube/youtubeTranscriptFetcher.js UCxxxxxxxxxxxxxxxxxxxxxx 240 5

import axios from "axios";
import { YoutubeTranscript } from "youtube-transcript";
import { fileURLToPath } from "url";

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

/**
 * Every YouTube channel has a hidden "uploads" playlist listing all
 * its videos newest-first. We fetch that playlist ID once, then page
 * through playlistItems (cheap, 1 unit) instead of search.list
 * (100 units/call).
 */
async function getChannelUploadsPlaylistId(channelId) {
  const { data } = await axios.get(`${YOUTUBE_API_BASE}/channels`, {
    params: {
      part: "contentDetails",
      id: channelId,
      key: YOUTUBE_API_KEY,
    },
    timeout: 15000,
  });

  const items = data.items || [];
  if (items.length === 0) {
    throw new Error(`No channel found for channelId=${channelId}`);
  }

  return items[0].contentDetails.relatedPlaylists.uploads;
}

/**
 * Returns recent video metadata (videoId, title, publishedAt) from the
 * channel, filtered to those published within `minutesBack` minutes,
 * newest first, capped at `maxVideos`.
 */
/**
 * Quick, free (no API call) heuristic to catch livestream VODs by title
 * pattern. Channels like Sky Sports Cricket / talkSPORT consistently title
 * these "LIVE | ..." or "LIVE: ...". Livestream VODs often never get
 * auto-captions the way normal uploads do (or take far longer), so these
 * were burning through the full transcript-retry ceiling for nothing --
 * this catches them BEFORE they ever enter the retry queue.
 */
export function looksLikeLivestreamTitle(title = "") {
  return /^\s*live\s*[|:]/i.test(title);
}

/**
 * Fetches a video's real duration (minutes) AND live-broadcast status in
 * ONE API call (1 unit) via videos.list. liveBroadcastContent is "live",
 * "upcoming", or "none" -- "live"/"upcoming" means it's currently
 * live/scheduled and definitely has no transcript yet. Returns null
 * fields if the lookup fails for any reason; callers should fall back to
 * a sane default rather than crash.
 */
export async function getVideoMetadata(videoId) {
  try {
    const { data } = await axios.get(`${YOUTUBE_API_BASE}/videos`, {
      params: {
        part: "snippet,contentDetails",
        id: videoId,
        key: YOUTUBE_API_KEY,
      },
      timeout: 15000,
    });

    const item = data.items?.[0];
    if (!item) return { durationMinutes: null, liveBroadcastContent: null };

    const iso = item.contentDetails?.duration; // e.g. "PT15M33S"
    let durationMinutes = null;
    if (iso) {
      const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (match) {
        const hours = parseInt(match[1] || "0", 10);
        const minutes = parseInt(match[2] || "0", 10);
        const seconds = parseInt(match[3] || "0", 10);
        durationMinutes = hours * 60 + minutes + seconds / 60;
      }
    }

    return {
      durationMinutes,
      liveBroadcastContent: item.snippet?.liveBroadcastContent ?? null, // "live" | "upcoming" | "none"
    };
  } catch (err) {
    console.warn(`⚠️ Failed to fetch metadata for ${videoId}:`, err.message);
    return { durationMinutes: null, liveBroadcastContent: null };
  }
}

/**
 * Kept for backward compatibility with any existing callers -- prefer
 * getVideoMetadata() for new code since it gets duration AND live-status
 * in a single API call instead of two.
 */
export async function getVideoDurationMinutes(videoId) {
  const { durationMinutes } = await getVideoMetadata(videoId);
  return durationMinutes;
}

export async function getRecentVideos({
  channelId,
  minutesBack = 240,
  maxVideos = 5,
}) {
  if (!YOUTUBE_API_KEY) {
    throw new Error(
      "YOUTUBE_API_KEY env var not set. See module header for setup.",
    );
  }

  const uploadsPlaylistId = await getChannelUploadsPlaylistId(channelId);

  const { data } = await axios.get(`${YOUTUBE_API_BASE}/playlistItems`, {
    params: {
      part: "snippet,contentDetails",
      playlistId: uploadsPlaylistId,
      maxResults: Math.max(maxVideos, 10), // pad since we filter by time after
      key: YOUTUBE_API_KEY,
    },
    timeout: 15000,
  });

  const cutoff = Date.now() - minutesBack * 60 * 1000;

  const recent = (data.items || [])
    .map((item) => {
      const s = item.snippet;
      return {
        videoId: s.resourceId.videoId,
        title: s.title,
        publishedAt: s.publishedAt,
        channelTitle: s.channelTitle,
        publishedAtMs: new Date(s.publishedAt).getTime(),
      };
    })
    .filter((v) => v.publishedAtMs >= cutoff)
    .sort((a, b) => b.publishedAtMs - a.publishedAtMs)
    .slice(0, maxVideos)
    .map(({ publishedAtMs, ...rest }) => rest); // drop the helper field

  return recent;
}

/**
 * Fetches the transcript for a single video and returns it as one
 * plain-text string, or null if no transcript exists (captions
 * disabled, video too new for auto-captions, video unavailable, etc.)
 * -- caller should skip that video when null.
 */
export async function fetchTranscriptText(videoId, lang = "en") {
  try {
    const segments = await YoutubeTranscript.fetchTranscript(videoId, { lang });
    return segments.map((seg) => seg.text).join(" ");
  } catch (err) {
    // Try without a forced language (library default / auto-detect)
    // before giving up -- covers Hindi/Hinglish videos with captions
    // in a track that doesn't match 'en'.
    try {
      const segments = await YoutubeTranscript.fetchTranscript(videoId);
      return segments.map((seg) => seg.text).join(" ");
    } catch (err2) {
      return null;
    }
  }
}

/**
 * Main entry point. Combines getRecentVideos + fetchTranscriptText.
 * Returns an array of video objects, each with metadata plus
 * transcriptText (string) or transcriptText: null if unavailable.
 *
 * Videos with no transcript are still included (transcriptText: null)
 * so the caller/pipeline can log or skip them explicitly, rather than
 * silently vanishing.
 */
export async function getRecentTranscripts({
  channelId,
  minutesBack = 240,
  maxVideos = 5,
}) {
  const videos = await getRecentVideos({ channelId, minutesBack, maxVideos });

  const results = [];
  for (const video of videos) {
    const transcriptText = await fetchTranscriptText(video.videoId);
    results.push({ ...video, transcriptText });
  }

  return results;
}

// Quick manual test when run directly:
//   node youtube/youtubeTranscriptFetcher.js <channelId> [minutesBack] [maxVideos]
//
// ES module equivalent of `require.main === module`:
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  const [channelId, minutesBackArg, maxVideosArg] = process.argv.slice(2);

  if (!channelId) {
    console.log(
      "Usage: node youtube/youtubeTranscriptFetcher.js <channelId> [minutesBack] [maxVideos]",
    );
    process.exit(1);
  }

  const minutesBack = minutesBackArg ? parseInt(minutesBackArg, 10) : 240;
  const maxVideos = maxVideosArg ? parseInt(maxVideosArg, 10) : 5;

  try {
    const videos = await getRecentTranscripts({
      channelId,
      minutesBack,
      maxVideos,
    });

    if (videos.length === 0) {
      console.log(`No videos found in the last ${minutesBack} minutes.`);
    }

    for (const v of videos) {
      console.log("=".repeat(60));
      console.log(`Title: ${v.title}`);
      console.log(`Video ID: ${v.videoId}`);
      console.log(`Published: ${v.publishedAt}`);
      if (v.transcriptText) {
        console.log(`Transcript (${v.transcriptText.length} chars):`);
        console.log(v.transcriptText.slice(0, 500) + "...");
      } else {
        console.log(
          "Transcript: NOT AVAILABLE (captions disabled or video too new)",
        );
      }
    }
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}
