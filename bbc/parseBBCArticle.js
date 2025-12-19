// parseBBCArticle.js
import * as cheerio from "cheerio";

export function parseBBCArticle(html) {
  const $ = cheerio.load(html);

  const headline =
    $('h1[data-testid="headline"]').text().trim() ||
    $("h1").first().text().trim();

  const paragraphs = [];

  $("article p").each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 40) paragraphs.push(text);
  });

  return {
    headline,
    body: paragraphs.join("\n"),
  };
}
