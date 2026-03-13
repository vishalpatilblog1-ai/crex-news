// ndtv/parseNDTVArticle.js
import * as cheerio from "cheerio";

export function parseNDTVArticle(html) {
  const $ = cheerio.load(html);

  // Headline
  const headline =
    $("h1").first().text().trim() ||
    $("meta[property='og:title']").attr("content") ||
    "";

  const paragraphs = [];

  const selectors = [
    "div[itemprop='articleBody'] p",
    "div.ins_storybody p",
    "div.story__content p",
    "article p",
  ];

  for (const selector of selectors) {
    $(selector).each((_, el) => {
      const text = $(el).text().trim();

      if (
        text.length > 40 &&
        !text.toLowerCase().includes("advertisement") &&
        !text.toLowerCase().includes("ndtv") &&
        !text.toLowerCase().includes("subscribe")
      ) {
        paragraphs.push(text);
      }
    });

    // stop early (enough context for AI)
    if (paragraphs.length >= 3) break;
  }

  return {
    headline,
    body: paragraphs.join("\n"),
    paragraphCount: paragraphs.length,
  };
}
