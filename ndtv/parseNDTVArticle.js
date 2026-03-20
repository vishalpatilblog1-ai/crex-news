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
        !text.toLowerCase().includes("subscribe")
      ) {
        paragraphs.push(text);
      }
    });
  }

  // 🆕 TABLE PARSING START
  const tableData = [];

  $("table tr").each((_, row) => {
    const cols = $(row)
      .find("th, td")
      .map((_, col) => $(col).text().trim())
      .get();

    if (cols.length > 0) {
      tableData.push(cols);
    }
  });

  // Convert to structured format (skip header row)
  let formattedTable = [];

  if (tableData.length > 1) {
    const headers = tableData[0];

    formattedTable = tableData.slice(1).map((row) => {
      const obj = {};
      headers.forEach((key, index) => {
        obj[key] = row[index];
      });
      return obj;
    });
  }
  // 🆕 TABLE PARSING END

  return {
    headline,
    body: paragraphs.join("\n"),
    paragraphCount: paragraphs.length,
    table: formattedTable, // 🔥 NEW FIELD
  };
}
