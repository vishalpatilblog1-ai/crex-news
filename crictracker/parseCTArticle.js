import { decode } from "html-entities";
import { stripHtml } from "string-strip-html";

export function parseCTArticle(item) {
  const html = item["content:encoded"];
  if (!html) return null;

  const { result } = stripHtml(html, {
    ignoreTags: ["img", "figure", "figcaption"],
  });

  return {
    headline: decode(item.title),
    body: decode(result).trim(),
    link: item.link,
    pubDate: item.pubDate,
  };
}
