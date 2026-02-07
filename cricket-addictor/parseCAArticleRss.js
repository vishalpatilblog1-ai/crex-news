// cricket-addictor/parseCAArticle.js
import * as cheerio from "cheerio";

export function parseCAArticleRss(item) {
  const html = item?.["content:encoded"] || item?.description;
  if (!html) return null;

  const $ = cheerio.load(html);
  const paragraphs = [];

  // 🖼️ Extract first image
  const imageUrl = $("img").first().attr("src") || null;

  $("p").each((_, el) => {
    const text = $(el).text().trim();

    if (text.length < 40 || /read more|read also|fantasy|dream11/i.test(text)) {
      return;
    }

    paragraphs.push(text);
  });

  if (!paragraphs.length) return null;

  return {
    headline: item.title?.trim(),
    body: paragraphs.join("\n"),
    paragraphCount: paragraphs.length,
    imageUrl, // 🔥 IMPORTANT
  };
}
