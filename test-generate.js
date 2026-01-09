import { generateBBCNewsTweet } from "./bbc/ai/generateBBCNewsTweet.js";
import { generateIENewsTweet } from "./indian-express/ai/generateIENewsTweet.js";
import { generateIENewsTweet_ } from "./indian-express/ai/generateIENewsTweet_.js";
import { fetchIEArticle } from "./indian-express/fetchIEArticle.js";
import { parseIEArticle } from "./indian-express/parseIEArticle.js";
import { generateCommonStyleTweet } from "./twitter/generateCommonStyleTweet.js";

const SAMPLE_BODY = `
Rohit Sharma and Virat Kohli will return to domestic cricket in the second round of the Vijay Hazare Trophy 2025-26 today. Mumbai faces Uttarakhand while Delhi takes on Gujarat, with both veterans having scored centuries in the opening round.
`;

async function runTest() {
  try {
    const testLink =
      "https://indianexpress.com/article/sports/cricket/will-young-new-zealand-india-champions-trophy-revenge-10464660/";
    const html = await fetchIEArticle(testLink);
    const parsed = parseIEArticle(html);
    // console.log("parsed::", parsed);

    // const tweet_news = await generateIENewsTweet_(parsed.body);
    // console.log("✅ AI news Tweet Output:");
    // console.log(tweet_news);
    // console.log("article::", parsed.headline + parsed.body);
    const tweet_spice = await generateCommonStyleTweet(
      parsed.headline + parsed.body,
      "Indian Express"
    );
    console.log("✅ AI spice Tweet Output:");
    console.log(tweet_spice);
  } catch (err) {
    console.error("❌ TEST FAILED:", err.message);
  }
}

runTest();
