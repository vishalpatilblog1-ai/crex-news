// parseHinduArticle.js
import * as cheerio from "cheerio";

export function parseHinduArticle(html) {
  const $ = cheerio.load(html);

  const headline =
    $("h1").first().text().trim() ||
    $('meta[property="og:title"]').attr("content") ||
    "";

  const paragraphs = [];

  $("div[itemprop='articleBody'] p").each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 50) {
      paragraphs.push(text);
    }
  });

  return {
    headline,
    body: paragraphs.join("\n"),
  };
}
