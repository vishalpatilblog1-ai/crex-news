import generateTweet from "./ai.js";
import {
  matchContextData_australia_batting,
  matchContextData_handleNull,
  matchContextData_india_batting,
  matchContextData_pakistan_batting,
} from "./matchContextData_india_batting.js";
import { matchContextData_india_bowling } from "./matchContextData_india_bowling.js";
import { matchContextdata_other } from "./matchContextData_other.js";

async function test() {
  for (let index = 0; index < 5; index++) {
    const tweet = await generateTweet(matchContextData_handleNull);
    console.log("\n=======================\n");
    console.log(tweet);
  }
}

test();
