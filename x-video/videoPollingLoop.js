// videoPollingLoop.js
import { TARGET_USERNAMES } from "./videoSources.js";
import { getUserIds } from "./getUserIds.js";
import { fetchLatestVideoTweets } from "./fetchVideoTweets.js";
import { quoteVideoTweet } from "./quoteVideoTweet.js";
import { generateCaption } from "./generateCaption.js";
// import { quoteVideoTweet } from "./quoteVideoTweet.js";

const SEEN = new Set();

export async function videoPollingLoop() {
  console.log("🎥 Checking IPL/BCCI videos...");

  const userMap = await getUserIds(TARGET_USERNAMES);

  for (const username of TARGET_USERNAMES) {
    const userId = userMap[username];
    if (!userId) continue;

    const videos = await fetchLatestVideoTweets(userId);

    for (const video of videos) {
      if (SEEN.has(video.tweetId)) continue;

      // 🔥 Your AI / template text
      const tweetText = await generateCaption(video.text);

      await quoteVideoTweet({
        tweetId: video.tweetId,
        text: tweetText,
      });

      SEEN.add(video.tweetId);
    }
  }
}
