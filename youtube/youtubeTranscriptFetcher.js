// youtube/youtubeTranscriptFetcher.js

import axios from "axios";
import { YoutubeTranscript } from "youtube-transcript";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import fs from "fs/promises";
dotenv.config();

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

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

    await fs.writeFile(
      "test-transcript.txt",
      videos[0].transcriptText,
      "utf-8",
    );
    console.log(
      `Saved ${videos[0].transcriptText.length} chars to test-transcript.txt`,
    );

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
