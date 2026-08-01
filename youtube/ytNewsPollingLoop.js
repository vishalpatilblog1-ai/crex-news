// youtube/ytNewsPollingLoop.js
//
// Matches the pattern of your existing *NewsPollingLoop.js files
// (caNewsPollingLoop.js, cricbuzzNewsPollingLoop.js, etc.) so it wires
// into index.js the same way.
//
// Wraps runMultiTweetPipeline() to poll one or more YouTube channels
// on an interval. Video-level and angle-level dedup is already handled
// inside runMultiTweetPipeline via global.STATE, so calling this
// repeatedly is safe -- already-processed videos/angles are skipped
// automatically, not reprocessed.
//
// CONFIG
// ------
// Set which channels to monitor via env var (comma-separated channel IDs):
//   YOUTUBE_CHANNEL_IDS="UCtB4Jl_0Nqkme13o7hyEMwg,UCanotherChannelId..."
//
// If YOUTUBE_CHANNEL_IDS isn't set, falls back to just Rohit Juglan's
// channel as a sane default for now.

import { runMultiTweetPipeline } from "./youtubeMultiTweetPipeline.js";

const DEFAULT_CHANNEL_IDS = ["UCtB4Jl_0Nqkme13o7hyEMwg"]; // Rohit Juglan

function getConfiguredChannelIds() {
  const raw = process.env.YOUTUBE_CHANNEL_IDS;
  if (!raw) return DEFAULT_CHANNEL_IDS;
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

let isPolling = false; // simple lock -- prevents overlapping runs if called again before the previous one finishes

export async function youtubeNewsPollingLoop() {
  if (isPolling) {
    console.log(
      "⏭️ YouTube polling already in progress, skipping this tick to avoid overlap.",
    );
    return;
  }
  isPolling = true;

  try {
    const channelIds = getConfiguredChannelIds();
    console.log(
      `📺 YouTube polling loop running for ${channelIds.length} channel(s)...`,
    );

    for (const channelId of channelIds) {
      try {
        // Short lookback window for the recurring loop -- unlike a manual
        // one-off CLI test run (where a wide window like 1440 min makes sense
        // to guarantee finding something to test with), production polling
        // should only look at genuinely recent uploads. A wide window here
        // causes the SAME already-processed video to be refetched on every
        // tick indefinitely. 30 min lookback + a 15-min poll interval gives
        // enough overlap to never miss a video between polls.
        await runMultiTweetPipeline(channelId, {
          // minutesBack: 30,
          minutesBack: 3440,
          maxAngles: 3,
        });
      } catch (err) {
        // One channel failing shouldn't stop the others from being checked.
        console.error(
          `❌ YouTube polling failed for channel ${channelId}:`,
          err?.message || err,
        );
      }
    }
  } finally {
    isPolling = false;
  }
}
