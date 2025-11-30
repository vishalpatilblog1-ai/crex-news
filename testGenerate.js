import generateTweet from "./ai.js";
import { matchContextData_all_milestones } from "./matchContextTextData.js";

async function test() {
  for (let index = 0; index < 1; index++) {
    const tweet = await generateTweet(matchContextData_all_milestones);
    console.log("\n=======================\n");
    console.log(tweet);
  }
}

test();
