// cricket-addictor/parseCAArticle.js
import fetch from "node-fetch";
import * as cheerio from "cheerio";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export async function parseCAArticle(item) {
  // ====================
  // 1. RSS MODE
  // ====================
  if (item?.["content:encoded"]) {
    const html = item["content:encoded"];
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

    if (paragraphs.length === 0) return null;

    // RSS images usually come from enclosure/media fields
    const imageUrl = item.enclosure?.url || item["media:content"]?.url || null;

    return {
      headline: item.title?.trim(),
      body: paragraphs.join("\n"),
      paragraphCount: paragraphs.length,
      imageUrl,
    };
  }

  // ====================
  // 2. HTML MODE
  // ====================
  if (!item?.link) return null;

  let res;
  try {
    res = await fetch(item.link, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html",
      },
    });
  } catch {
    return null;
  }

  if (!res.ok) return null;

  const html = await res.text();
  const $ = cheerio.load(html);

  const headline =
    $('meta[property="og:title"]').attr("content") ||
    $("h1").first().text().trim();

  const imageUrl =
    $('meta[property="og:image"]').attr("content") ||
    $('meta[name="twitter:image"]').attr("content") ||
    $("article img").first().attr("src") ||
    null;

  const paragraphs = [];

  $("article p").each((_, el) => {
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

  if (!headline || paragraphs.length === 0) return null;

  return {
    headline,
    body: paragraphs.join("\n"),
    paragraphCount: paragraphs.length,
    imageUrl,
  };
}
