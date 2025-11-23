import { initPuppeteer, postTweet } from "./postTweet.js";

(async () => {
  await initPuppeteer();
  await postTweet("🔥 Test tweet from Puppeteer!");
  console.log("Done!");
})();
