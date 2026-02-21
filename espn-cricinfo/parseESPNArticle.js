// // espn-cricinfo/parseESPNArticle.js
// import fetch from "node-fetch";
// import * as cheerio from "cheerio";

// const USER_AGENT =
//   "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0 Safari/537.36";

// export async function parseESPNArticle({ url }) {
//   if (!url) return null;

//   const res = await fetch(url, {
//     headers: {
//       "User-Agent": USER_AGENT,
//       Accept: "text/html",
//     },
//   });

//   // 🔒 Hard stop if blocked
//   if (!res.ok) return null;

//   const html = await res.text();
//   const $ = cheerio.load(html);

//   const headline =
//     $('meta[property="og:title"]').attr("content") ||
//     $("h1").first().text().trim();

//   const paragraphs = [];

//   $(
//     'div[data-testid="article-body"] p, ' +
//       "div.ds-text-compressed-m p, " +
//       "div.ci-story-body p"
//   ).each((_, el) => {
//     const text = $(el).text().trim();
//     if (text.length < 40) return;
//     paragraphs.push(text);
//   });

//   // ⚠️ Partial HTML is acceptable, but empty is not
//   if (!headline || paragraphs.length === 0) return null;

//   return {
//     headline,
//     body: paragraphs.join("\n"),
//     paragraphCount: paragraphs.length,
//   };
// }
