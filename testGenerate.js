import generateTweet from "./ai.js";
import { matchContextData_fistInning } from "./matchContextTextData.js";

async function test() {
  for (let index = 0; index < 5; index++) {
    const tweet = await generateTweet(matchContextData_fistInning);
    console.log("\n=======================\n");
    console.log(tweet);
  }
}

test();
