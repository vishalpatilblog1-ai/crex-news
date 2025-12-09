import generateTweet from "./cricbuzz/ai/ai.js";
import {
  matchContextData_maiden_over,
  matchContext_T20_firstInning,
} from "./matchContextTextData.js";
import { postTweet_http2 } from "./postTweet_http2.js";

async function test() {
  for (let index = 0; index < 1; index++) {
    const tweet = await generateTweet(matchContext_T20_firstInning);

    console.log(tweet);
  }
}

test();
