import generateTweet from "./cricbuzz/ai/ai.js";
import { matchContext_T20_secondInning_live_india_match } from "./matchContextTextData.js";

async function test() {
  for (let index = 0; index < 1; index++) {
    // const tweet = await generateTweet(matchContext_T20_secondInning);
    const tweet = await generateTweet(
      matchContext_T20_secondInning_live_india_match
    );

    console.log(tweet);
  }
}

test();
