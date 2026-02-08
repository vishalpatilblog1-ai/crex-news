import { Readability } from "@mozilla/readability";
import * as cheerio from "cheerio";
import { JSDOM } from "jsdom";
import fetch from "node-fetch";

export function extractArticleText(html, url) {
  try {
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article || !article.textContent) return null;

    return article.textContent.replace(/\s+/g, " ").trim();
  } catch (err) {
    console.warn("⚠️ Readability extraction failed:", err.message);
    return null;
  }
}
export function safeParseGeminiJSON(text) {
  console.log("text::", text);
  if (!text) return null;

  // 1️⃣ Remove code fences
  const cleaned = stripCodeFences(text).trim();

  // 2️⃣ Try to locate JSON array anywhere in text
  const match = cleaned.match(/\[[\s\S]*\]/);

  if (!match) {
    console.warn("⚠️ No JSON array found, skipping cycle");
    return null;
  }

  const jsonCandidate = match[0];

  try {
    return JSON.parse(jsonCandidate);
  } catch (err) {
    console.warn("⚠️ JSON parse failed, skipping cycle");
    return null;
  }
}

// export function safeParseGeminiJSON(text) {
//   console.log("text::", text);
//   if (!text) return null;

//   // hard reject if model talks
//   if (
//     text.startsWith("Okay") ||
//     text.startsWith("Sure") ||
//     text.startsWith("I will") ||
//     !text.trim().startsWith("[")
//   ) {
//     console.warn("⚠️ Gemini returned non-JSON, skipping cycle");
//     return null;
//   }

//   try {
//     return JSON.parse(stripCodeFences(text));
//   } catch {
//     console.warn("⚠️ JSON parse failed, skipping cycle");
//     return null;
//   }
// }

// export function shouldAcceptByTime(publishedAt) {
//   if (!publishedAt) return false;

//   if (isWithinTimeWindow(publishedAt)) return true;

//   return DEBUG_FORCE_FIRST_RESULT;
// }

export function normalizePublishedAt(publishedAt) {
  if (!publishedAt) return null;

  // If only YYYY-MM-DD, assume recent (set to noon UTC)
  if (/^\d{4}-\d{2}-\d{2}$/.test(publishedAt)) {
    return `${publishedAt}T12:00:00Z`;
  }

  return publishedAt;
}

export async function extractPublishedAt(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });

  const html = await res.text();
  const $ = cheerio.load(html);

  // 1️⃣ OpenGraph / Meta tags
  const metaTime =
    $('meta[property="article:published_time"]').attr("content") ||
    $('meta[name="publish-date"]').attr("content") ||
    $('meta[itemprop="datePublished"]').attr("content");

  if (metaTime) return new Date(metaTime).toISOString();

  // 2️⃣ JSON-LD (very common on ET / IE)
  const jsonLd = $('script[type="application/ld+json"]')
    .map((_, el) => $(el).html())
    .get();

  for (const block of jsonLd) {
    try {
      const data = JSON.parse(block);

      const items = Array.isArray(data) ? data : [data];

      for (const item of items) {
        if (item.datePublished) {
          return new Date(item.datePublished).toISOString();
        }
      }
    } catch {
      // ignore parse errors
    }
  }

  return null;
}

export function extractGeminiText(response) {
  if (typeof response.text === "string" && response.text.trim()) {
    return response.text;
  }

  return response.candidates?.[0]?.content?.parts
    ?.map((p) => p.text)
    ?.join("")
    ?.trim();
}
export async function getOgImage(articleUrl) {
  if (!articleUrl) return null;

  try {
    const res = await fetch(articleUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    const html = await res.text();
    const $ = cheerio.load(html);

    // 1️⃣ OG / Twitter image (fast path)
    const ogImage =
      $('meta[property="og:image"]').attr("content") ||
      $('meta[name="twitter:image"]').attr("content");

    if (ogImage && ogImage.startsWith("http")) {
      return ogImage;
    }

    // 2️⃣ NDTV / Article body image fallback
    const bodyImg =
      $("article img").first().attr("src") ||
      $("figure img").first().attr("src") ||
      $("article img").first().attr("data-src") ||
      $("figure img").first().attr("data-src");

    if (bodyImg && bodyImg.startsWith("http")) {
      return bodyImg;
    }

    // 3️⃣ Last-resort: any large image on page
    const anyImg = $("img")
      .map((_, el) => $(el).attr("src") || $(el).attr("data-src"))
      .get()
      .find((src) => src && src.includes("ndtvimg.com"));

    return anyImg || null;
  } catch (err) {
    console.warn("⚠️ Image extraction failed:", err.message);
    return null;
  }
}
export function stripCodeFences(text) {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export function dedupeBySource(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (seen.has(item.sourceUrl)) return false;
    seen.add(item.sourceUrl);
    return true;
  });
}

const MAX_AGE_MINUTES = 300;

export function isWithinTimeWindow(publishedAt) {
  if (!publishedAt) return false;

  const publishedTime = new Date(publishedAt).getTime();
  if (Number.isNaN(publishedTime)) return false;

  const now = Date.now();
  const diffMs = now - publishedTime;

  if (diffMs < 0) return false;

  return diffMs <= MAX_AGE_MINUTES * 60 * 1000;
}
export async function resolveFinalUrl(url) {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });

  return res.url;
}
