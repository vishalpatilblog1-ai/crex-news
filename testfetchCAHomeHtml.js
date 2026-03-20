// testIEImageDecision.js

// import { generateClaudeTweetWithType } from "./ai/generateClaudeTweet.js";
// import { fetchNDTVArticle } from "./ndtv/fetchNDTVArticle.js";
// import { parseNDTVArticle } from "./ndtv/parseNDTVArticle.js";

// async function run() {
//   const url =
//     "https://www.crictracker.com/cricket-appeal/ipl-2026-full-list-of-injured-and-unavailable-players/";
//   const html = await fetchNDTVArticle(url);
//   const parsed = parseNDTVArticle(html);
//   const fullText = `
//   ${parsed.headline}

//   ${parsed.body}

//   ${JSON.stringify(parsed.table)}
//   `;
//   const result = await generateClaudeTweetWithType(fullText, "injury_news");
//   const tweetText = result.tweetText;
//   console.log("tweetText::", tweetText);
// }

// run();

// testCTSingleUrl.js

import axios from "axios";
import {
  classifyArticle,
  generateClaudeTweetWithType,
} from "./ai/generateClaudeTweet.js";
import { parseCTArticle } from "./crictracker/parseCTArticle.js";

async function run() {
  const url =
    "https://www.crictracker.com/cricket-appeal/ipl-2026-full-list-of-injured-and-unavailable-players/";

  const { data: html } = await axios.get(url);

  const fakeItem = {
    title: "Test",
    link: url,
    pubDate: new Date().toISOString(),
    "content:encoded": html, // ✅ critical fix
  };

  const parsed = parseCTArticle(fakeItem);

  if (!parsed) {
    console.log("❌ parsing failed");
    return;
  }

  const fullText = `
${parsed.headline}

${parsed.body}

${JSON.stringify(parsed.table)}
`;

  let articleType = "player_form";
  try {
    articleType = await classifyArticle(fullText);
  } catch {}

  const result = await generateClaudeTweetWithType(fullText, articleType);

  console.log("tweetText::", result.tweetText);
}

run();
