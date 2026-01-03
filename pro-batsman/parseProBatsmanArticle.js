// parseProBatsmanArticle.js
import * as cheerio from "cheerio";

export function parseProBatsmanArticle(html) {
  const $ = cheerio.load(html);

  const paragraphs = [];

  $("p").each((_, el) => {
    const text = $(el).text().trim();

    // Remove boilerplate
    if (
      text.length < 50 ||
      text.startsWith("Story First Published") ||
      text.startsWith("More Stories")
    ) {
      return;
    }

    paragraphs.push(text);
  });

  return {
    body: paragraphs.join("\n"),
  };
}
