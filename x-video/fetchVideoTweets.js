// fetchVideoTweets.js
// import { twitterClient } from "./twitterClient.js";

import { twitterClient } from "../twitter/twitter.js";

export async function fetchLatestVideoTweets(userId) {
  const client = twitterClient.readOnly;

  const response = await client.v2.userTimeline(userId, {
    max_results: 5,
    expansions: ["attachments.media_keys"],
    "media.fields": ["type", "url", "preview_image_url"],
    "tweet.fields": ["created_at", "text"],
  });

  const tweets = response.data?.data || [];
  const media = response.data?.includes?.media || [];

  return tweets
    .map((tweet) => {
      const mediaKeys = tweet.attachments?.media_keys || [];

      const videoMedia = media.find(
        (m) => mediaKeys.includes(m.media_key) && m.type === "video"
      );

      if (!videoMedia) return null;

      return {
        tweetId: tweet.id,
        text: tweet.text,
        videoPreview: videoMedia.preview_image_url,
      };
    })
    .filter(Boolean);
}
