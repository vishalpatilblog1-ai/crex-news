// cricket-addictor/parseCAArticle.js
import * as cheerio from "cheerio";

export function parseCAArticle(item) {
  const html = item?.["content:encoded"];
  if (!html) return null;

  const $ = cheerio.load(html);
  const paragraphs = [];

  $("p").each((_, el) => {
    const text = $(el).text().trim();

    if (
      text.length < 40 ||
      text.toLowerCase().includes("read also") ||
      text.toLowerCase().includes("fantasy") ||
      text.toLowerCase().includes("dream11")
    ) {
      return;
    }

    paragraphs.push(text);
  });

  return {
    headline: item.title?.trim(),
    // body: paragraphs.slice(0, 3).join("\n"),
    body: paragraphs.join("\n"),
    paragraphCount: paragraphs.length,
  };
}
