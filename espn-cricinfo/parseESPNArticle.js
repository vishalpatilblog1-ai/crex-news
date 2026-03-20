import fetch from "node-fetch";
import * as cheerio from "cheerio";

const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function parseESPNArticle({ storyId, title }) {
  if (!storyId || !title) return null;

  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");

  const canonicalUrl = `https://www.espncricinfo.com/story/${slug}-${storyId}`;
  // console.log("parseESPNArticle::", storyId, title);
  // console.log("slug::", slug);
  // console.log("Fetching canonical URL:", canonicalUrl);

  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 1) await sleep(300 * attempt + Math.random() * 400);

      const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

      const res = await fetch(canonicalUrl, {
        headers: {
          "User-Agent": ua,
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "en-IN,en-GB;q=0.9,en-US;q=0.8,en;q=0.7",
          "Accept-Encoding": "gzip, deflate, br",
          Connection: "keep-alive",
          "Cache-Control": "max-age=0",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "none",
          "Sec-Fetch-User": "?1",
          "Upgrade-Insecure-Requests": "1",
          Referer: "https://www.espncricinfo.com/cricket-news",
          DNT: "1",
          "Sec-Ch-Ua":
            '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
          "Sec-Ch-Ua-Mobile": "?0",
          "Sec-Ch-Ua-Platform": '"macOS"',
        },
        redirect: "follow",
      });

      console.log("ESPN fetch status:", res.status, `(attempt ${attempt})`);

      if (res.status === 403) {
        console.warn(`⚠️ ESPN 403 on attempt ${attempt}/${maxRetries}`);
        if (attempt === maxRetries) return null;
        continue;
      }

      if (!res.ok) return null;

      // console.log("res:::", res);
      const html = await res.text();
      const $ = cheerio.load(html);

      // console.log("$:::", $);

      // const nextDataRaw = $("#__NEXT_DATA__").text();
      const nextDataRaw =
        $('script[id="__NEXT_DATA__"]').text() ||
        $('script[type="application/json"]').text();

      // console.log("nextDataRaw::", nextDataRaw);
      if (!nextDataRaw) return null;

      const nextData = JSON.parse(nextDataRaw);
      // const story = nextData?.props?.appPageProps?.data?.data?.story;
      // const content =
      //   nextData?.props?.appPageProps?.data?.content?.content?.items;

      const story = nextData?.props?.appPageProps?.data?.data?.story;
      const content =
        nextData?.props?.appPageProps?.data?.data?.content?.content?.items;
      const headline = story?.title || "";
      const imageUrl = story?.image?.url
        ? `https://img1.hscicdn.com/image/upload/f_auto${story.image.url}`
        : null;

      const paragraphs = (content || [])
        .filter((item) => item.type === "HTML")
        .map((item) => cheerio.load(item.html).text().trim())
        .filter((text) => text.length > 40);

      if (!headline || paragraphs.length === 0) return null;

      // console.log(`✅ ESPN parsed: ${headline}`);
      return {
        headline,
        body: paragraphs.join("\n"),
        imageUrl,
        paragraphCount: paragraphs.length,
      };
    } catch (err) {
      console.warn(`⚠️ ESPN attempt ${attempt} failed: ${err.message}`);
      if (attempt === maxRetries) return null;
    }
  }

  return null;
}
// export async function parseESPNArticle({ url }) {
//   if (!url) return null;

//   const cleanUrl = url.replace(/[?&]ex_cid=[^&]+/, "");

//   const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

//   const res = await fetch(cleanUrl, {
//     headers: {
//       "User-Agent": ua,
//       Accept:
//         "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
//       "Accept-Language": "en-US,en;q=0.9",
//       "Accept-Encoding": "gzip, deflate, br",
//       Referer: "https://www.google.com/",
//       "Cache-Control": "no-cache",
//       Pragma: "no-cache",
//       "Sec-Fetch-Dest": "document",
//       "Sec-Fetch-Mode": "navigate",
//       "Sec-Fetch-Site": "cross-site",
//       "Upgrade-Insecure-Requests": "1",
//     },
//   });

//   // const res = await fetch(cleanUrl, {
//   //   headers: {
//   //     "User-Agent": ua,
//   //     Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
//   //     "Accept-Language": "en-US,en;q=0.9",
//   //     Referer: "https://www.google.com/",
//   //     "Cache-Control": "no-cache",
//   //   },
//   // });

//   console.log("res::", res);

//   if (!res.ok) return null;

//   const html = await res.text();
//   const $ = cheerio.load(html);

//   // Extract from __NEXT_DATA__ JSON — this is where ESPN stores article content
//   const nextDataRaw = $("#__NEXT_DATA__").text();
//   if (!nextDataRaw) return null;

//   try {
//     const nextData = JSON.parse(nextDataRaw);
//     const story = nextData?.props?.appPageProps?.data?.data?.story;
//     const content =
//       nextData?.props?.appPageProps?.data?.content?.content?.items;

//     const headline = story?.title || story?.seoTitle || "";

//     const imageUrl = story?.image?.url
//       ? `https://img1.hscicdn.com/image/upload/f_auto${story.image.url}`
//       : null;

//     const paragraphs = (content || [])
//       .filter((item) => item.type === "HTML")
//       .map((item) => cheerio.load(item.html).text().trim())
//       .filter((text) => text.length > 40);

//     if (!headline || paragraphs.length === 0) return null;

//     return {
//       headline,
//       body: paragraphs.join("\n"),
//       imageUrl,
//       paragraphCount: paragraphs.length,
//     };
//   } catch (err) {
//     console.error("❌ ESPN JSON parse failed:", err?.message);
//     return null;
//   }
// }
