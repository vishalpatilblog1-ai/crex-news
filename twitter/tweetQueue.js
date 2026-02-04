// twitter/tweetQueue.js

let queue = [];
let isPublishing = false;

const MIN_TWEET_GAP_MS = 1000 * 60 * 5; // 5 mins (World Cup safe)
let lastTweetAt = 0;

export function enqueueTweet(payload) {
  console.log("payload::", payload);
  queue.push({
    ...payload,
    enqueuedAt: Date.now(),
  });

  console.log(
    `📥 Tweet enqueued | source=${payload.source} | queue=${queue.length}`
  );

  processQueue();
}

async function processQueue() {
  if (isPublishing) return;
  if (queue.length === 0) return;

  const now = Date.now();
  const waitMs = Math.max(0, MIN_TWEET_GAP_MS - (now - lastTweetAt));

  isPublishing = true;

  setTimeout(async () => {
    const job = queue.shift();

    try {
      await job.publish();
      lastTweetAt = Date.now();
      console.log("✅ Tweet published from queue");
    } catch (err) {
      console.error("❌ Tweet publish failed, requeueing", err);
      queue.unshift(job);
    }

    isPublishing = false;
    processQueue();
  }, waitMs);
}
