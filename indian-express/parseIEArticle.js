// indian-express/parseIEArticle.js
import * as cheerio from "cheerio";

export function parseIEArticle(html) {
  const $ = cheerio.load(html);

  // Headline
  const headline = $("h1").first().text().trim();

  const paragraphs = [];

  const selectors = [
    "div[itemprop='articleBody'] p",
    "section[itemprop='articleBody'] p",
    "div.full-details p",
    "div.story-details p",
    "div#pcl-full-content p",
    "article p",
  ];

  for (const selector of selectors) {
    $(selector).each((_, el) => {
      const text = $(el).text().trim();

      if (
        text.length > 40 &&
        !text.toLowerCase().includes("advertisement") &&
        !text.toLowerCase().includes("subscribe")
      ) {
        paragraphs.push(text);
      }
    });

    // Stop once we have enough content
    if (paragraphs.length >= 3) break;
  }

  return {
    headline,
    body: paragraphs.join("\n"),
    paragraphCount: paragraphs.length,
  };
}
