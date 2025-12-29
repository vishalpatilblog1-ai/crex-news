import { generateBBCNewsTweet } from "./bbc/ai/generateBBCNewsTweet.js";
import { generateIENewsTweet } from "./indian-express/ai/generateIENewsTweet.js";
import { generateIENewsTweet_ } from "./indian-express/ai/generateIENewsTweet_.js";
import { fetchIEArticle } from "./indian-express/fetchIEArticle.js";
import { parseIEArticle } from "./indian-express/parseIEArticle.js";

const SAMPLE_BODY = `
Rohit Sharma and Virat Kohli will return to domestic cricket in the second round of the Vijay Hazare Trophy 2025-26 today. Mumbai faces Uttarakhand while Delhi takes on Gujarat, with both veterans having scored centuries in the opening round.
`;

async function runTest() {
  try {
    // const tweet = await generateViralTweet(SAMPLE_BODY, 240);
    const testLink =
      "https://www.thehindu.com/sport/cricket/smriti-mandhana-becomes-second-indian-fourth-player-overall-to-reach-10000-international-runs-in-womens-cricket/article70447324.ece";
    const html = await fetchIEArticle(testLink);
    const parsed = parseIEArticle(html);
    // console.log("parsed::", parsed);

    // const tweet_news = await generateIENewsTweet_(parsed.body);
    // console.log("✅ AI news Tweet Output:");
    // console.log(tweet_news);

    const tweet_spice = await generateIENewsTweet(parsed.body);
    console.log("✅ AI spice Tweet Output:");
    console.log(tweet_spice);
  } catch (err) {
    console.error("❌ TEST FAILED:", err.message);
  }
}

runTest();
