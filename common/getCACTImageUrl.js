// cricket-addictor/getCAImageUrl.js
import * as cheerio from "cheerio";

export function getCACTImageUrl(item) {
  const contentHtml = item?.["content:encoded"];
  if (contentHtml) {
    const $ = cheerio.load(contentHtml);
    const src = $("img").first().attr("src");
    if (src) {
      return normalizeImageUrl(src);
    }
  }

  const descHtml = item?.description;
  if (descHtml) {
    const $ = cheerio.load(descHtml);
    const src = $("img").first().attr("src");
    if (src) {
      return normalizeImageUrl(src);
    }
  }

  return null;
}

function normalizeImageUrl(url) {
  if (!url) return null;
  return url.split("?")[0];
}
