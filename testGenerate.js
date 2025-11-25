// import generateTweet from "./ai.js";

import generateTweet from "./ai.js";
import {
  matchContextT20Array,
  matchContextTestMatchArray,
} from "./public/dummyData.js";

async function test() {
  matchContextTestMatchArray.map(async (item) => {
    const tweet = await generateTweet(item);

    console.log("\n=======================");
    console.log("FINAL GENERATED TWEET:");
    console.log("=======================\n");
    console.log(tweet);
  });
  //   const tweet = await generateTweet(matchContext3);

  //   console.log("\n=======================");
  //   console.log("FINAL GENERATED TWEET:");
  //   console.log("=======================\n");
  //   console.log(tweet);
}

test();
