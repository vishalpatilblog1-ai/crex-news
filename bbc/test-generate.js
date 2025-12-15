// import { generateBBCNewsTweet } from "../generateBBCNewsTweet.js";

import { generateBBCNewsTweet } from "./ai/generateBBCNewsTweet.js";

const SAMPLE_BODY = `
Ben Stokes has urged England to show more fight as they prepare for the third Ashes Test.
England trail the series 2-0 after heavy defeats.
The match will be played at Adelaide Oval.
`;

async function runTest() {
  try {
    const tweet = await generateBBCNewsTweet(SAMPLE_BODY);

    console.log("✅ AI Tweet Output:");
    console.log(tweet);

    if (!tweet || tweet.length < 30) {
      throw new Error("Generated tweet too short or empty");
    }

    console.log("🟢 TEST PASSED");
  } catch (err) {
    console.error("❌ TEST FAILED:", err.message);
  }
}

runTest();
