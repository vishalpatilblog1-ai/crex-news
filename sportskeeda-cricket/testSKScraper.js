import "dotenv/config";

import { fetchSKCricketHtml } from "./fetchSKCricketHtml.js";
import { parseSKArticle } from "./parseSKArticle.js";

const limit = Number(process.argv[2] || 10);

try {
  const items = await fetchSKCricketHtml({ limit });
  console.log(`Found ${items.length} Sportskeeda cricket articles\n`);

  items.forEach((item, index) => {
    console.log(`${index + 1}. ${item.title}`);
    console.log(`   ${item.link}`);
  });

  if (items[0]) {
    console.log("\nParsing newest article...\n");
    const article = await parseSKArticle(items[0]);
    console.log(`Headline  : ${article?.headline || "Not found"}`);
    console.log(`Paragraphs: ${article?.paragraphCount || 0}`);
    console.log(`Image     : ${article?.imageUrl || "None"}`);
  }
} catch (error) {
  console.error("Sportskeeda scraper test failed:", error?.message || error);
  process.exitCode = 1;
}
