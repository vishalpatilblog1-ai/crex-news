// x-news-cricket/runXNewsOnce.js
//
// Runs xNewsPollingLoop() ONE time against your real STATE file, so you
// can test the two things that testXNewsTweet.js deliberately skips:
//   1. Does it actually post to X (when USE_WEB_TWEET=true)?
//   2. Does dedup correctly skip an already-seen story on the next run?
//
// Usage:
//   node x-news-cricket/runXNewsOnce.js
//
// Run it once → check X for the post. Run it again a few minutes later
// (same or new cricket news) → the same story should log "already seen"
// and skip, proving STATE.xnews.seen persisted correctly to disk between
// the two runs.
//
// Required env vars for a REAL post:
//   ENABLE_XNEWS_NEWS_POLLING=true
//   USE_WEB_TWEET=true
//   X_BEARER_TOKEN=<already set>
// Leave ENABLE_XNEWS_NEWS_POLLING or USE_WEB_TWEET unset/false to dry-run
// safely (it'll log what it WOULD post, without touching X or STATE's
// seen-list side effects around posting).

import "dotenv/config";
import { loadState } from "../utils/stateStoreCloud.js";
import { xNewsPollingLoop } from "./xNewsPollingLoop.js";

async function main() {
  console.log("🔄 Loading STATE from disk...");
  global.STATE = await loadState();

  console.log(
    `ℹ️ ENABLE_XNEWS_NEWS_POLLING=${process.env.ENABLE_XNEWS_NEWS_POLLING} | USE_WEB_TWEET=${process.env.USE_WEB_TWEET}`,
  );

  const seenCountBefore = Object.keys(global.STATE?.xnews?.seen || {}).length;
  console.log(`ℹ️ X News seen-story count before this run: ${seenCountBefore}`);

  const result = await xNewsPollingLoop();

  const seenCountAfter = Object.keys(global.STATE?.xnews?.seen || {}).length;
  console.log(`ℹ️ X News seen-story count after this run: ${seenCountAfter}`);
  console.log(`\n✅ xNewsPollingLoop() returned: ${result}`);

  if (result === "success" || result === true) {
    console.log(
      "→ A story was processed/queued this run. Run this script again in a few minutes — the SAME story should now be skipped as already-seen (unless a genuinely new story ranks higher).",
    );
  } else {
    console.log(
      "→ Nothing was queued this run (no candidates, all filtered, or all already-seen). Check the logs above for why.",
    );
  }
}

main().catch((error) => {
  console.error("\n❌ runXNewsOnce failed:", error?.message || error);
  process.exitCode = 1;
});
