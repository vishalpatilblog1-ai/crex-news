import { generateBBCNewsTweet } from "./bbc/ai/generateBBCNewsTweet.js";
import { generateBBCNewsTweet_ } from "./bbc/ai/generateBBCNewsTweet_.js";
import { generateIENewsTweet } from "./indian-express/ai/generateIENewsTweet.js";
import { generateIENewsTweet_ } from "./indian-express/ai/generateIENewsTweet_.js";
import { fetchIEArticle } from "./indian-express/fetchIEArticle.js";
import { parseIEArticle } from "./indian-express/parseIEArticle.js";

const SAMPLE_BODY = `



`;

const ieLinkArray = [
  {
    id: 1,
    link: "https://indianexpress.com/article/sports/cricket/josh-inglis-ipl-auction-lucknow-super-giants-8-6-crores-10428773",
  },
  {
    id: 2,
    link: "https://indianexpress.com/article/sports/cricket/england-vs-australia-michael-vaughan-ashes-bazball-10428691",
  },
  {
    id: 3,
    link: "https://indianexpress.com/article/sports/cricket/subramaniam-badrinath-praises-kkr-buys-after-2026-auction-the-biggest-positive-for-them-10428547",
  },
];

const bbcLinkArray = [
  {
    id: 1,
    link: "https://www.bbc.com/sport/cricket/articles/c04v2q5n5wqo#0",
  },
  {
    id: 2,
    link: "https://www.bbc.com/sport/cricket/articles/clyzpx5kqjdo#0",
  },
  {
    id: 3,
    link: "https://www.bbc.com/sport/cricket/articles/c3r73y94ppgo#0",
  },
];

async function runTest() {
  try {
    // const tweet = await generateViralTweet(SAMPLE_BODY, 240);
    // const testLink =
    //   "https://indianexpress.com/article/sports/cricket/josh-inglis-ipl-auction-lucknow-super-giants-8-6-crores-10428773";
    // const html = await fetchIEArticle(selected.link);

    bbcLinkArray?.map(async (link, index) => {
      const html = await fetchIEArticle(link.link);
      const parsed = parseIEArticle(html);

      const tweet_old = await generateBBCNewsTweet_(parsed.body);
      const tweet_new = await generateBBCNewsTweet(parsed.body);

      console.log("✅ AI Old Tweet Output:", index + 1);
      console.log(tweet_old);
      console.log("✅ AI New Tweet Output:", index + 1);
      console.log(tweet_new);
    });
  } catch (err) {
    console.error("❌ TEST FAILED:", err.message);
  }
}

runTest();
