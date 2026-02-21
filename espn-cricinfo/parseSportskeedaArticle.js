// // sportskeeda/parseSportskeedaArticle.js

// import fetch from "node-fetch";
// import * as cheerio from "cheerio";

// const USER_AGENT =
//   "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// export async function parseSportskeedaArticle(item) {
//   console.log("item::", item);
//   const link = item?.link || item?.url;
//   if (!link) return null;

//   console.log("link:::::", link);

//   let res;
//   try {
//     res = await fetch(link, {
//       headers: {
//         "User-Agent": USER_AGENT,
//         Accept: "text/html",
//       },
//     });
//   } catch {
//     return null;
//   }

//   // console.log("res:::", res);
//   if (!res.ok) return null;

//   const html = await res.text();
//   // console.log("html:::", html);
//   const $ = cheerio.load(html);

//   /* ---------------- headline ---------------- */
//   const headline =
//     $('meta[property="og:title"]').attr("content") ||
//     $("h1").first().text().trim();

//   if (!headline) return null;

//   /* ---------------- image ---------------- */
//   const imageUrl =
//     $('meta[property="og:image"]').attr("content") ||
//     $('meta[name="twitter:image"]').attr("content") ||
//     null;

//   /* ---------------- article body ---------------- */
//   const paragraphs = [];

//   $(
//     [
//       "div.article-body p",
//       "div#article-content p",
//       "article p",
//       "div[data-testid='article-content'] p",
//       "div.story-content p",
//     ].join(",")
//   ).each((_, el) => {
//     const text = $(el).text().trim();

//     // if (
//     //   text.length < 40 ||
//     //   text.toLowerCase().includes("read more") ||
//     //   text.toLowerCase().includes("also read") ||
//     //   text.toLowerCase().includes("advertisement") ||
//     //   text.toLowerCase().includes("subscribe") ||
//     //   text.toLowerCase().includes("follow us")
//     // ) {
//     //   return;
//     // }

//     // $("p").each((_, el) => {
//     //   const text = $(el).text().trim();
//     //   if (
//     //     text.length < 40 ||
//     //     text.toLowerCase().includes("read also") ||
//     //     text.toLowerCase().includes("fantasy") ||
//     //     text.toLowerCase().includes("dream11")
//     //   ) {
//     //     return;
//     //   }
//     //   paragraphs.push(text);
//     // });

//     paragraphs.push(text);
//   });

//   console.log("paragraphs::", paragraphs);
//   if (paragraphs.length === 0) return null;

//   return {
//     headline,
//     body: paragraphs.join("\n"),
//     paragraphCount: paragraphs.length,
//     imageUrl,
//     link,
//     pubDate: item.pubDate ? new Date(item.pubDate).getTime() : 0,
//   };
// }
