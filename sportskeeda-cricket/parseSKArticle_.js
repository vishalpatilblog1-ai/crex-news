// sportskeeda-cricket/parseSKArticle.js
import axios from "axios";
import * as cheerio from "cheerio";

import { normalizeSKLink } from "./skFilters.js";

const REQUEST_TIMEOUT_MS = Number(process.env.SK_REQUEST_TIMEOUT_MS || 15000);
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export async function parseSKArticle(itemOrUrl) {
  const link =
    typeof itemOrUrl === "string"
      ? itemOrUrl
      : itemOrUrl?.link || itemOrUrl?.url;

  if (!link) return null;

  const cleanLink = normalizeSKLink(link);
  const { data: html } = await axios.get(cleanLink, {
    timeout: REQUEST_TIMEOUT_MS,
    maxRedirects: 5,
    responseType: "text",
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
      Referer: "https://www.sportskeeda.com/cricket",
    },
    validateStatus: (status) => status >= 200 && status < 400,
  });

  const $ = cheerio.load(html);

  const headline = cleanText(
    $('meta[property="og:title"]').attr("content") ||
      $('meta[name="twitter:title"]').attr("content") ||
      $("h1").first().text(),
  ).replace(/\s*[-|]\s*Sportskeeda\s*$/i, "");

  const imageUrl = normalizeImageUrl(
    $('meta[property="og:image"]').attr("content") ||
      $('meta[name="twitter:image"]').attr("content") ||
      $("article img").first().attr("src") ||
      $("main img").first().attr("src") ||
      null,
    cleanLink,
  );

  const publishedAt =
    $('meta[property="article:published_time"]').attr("content") ||
    $("time").first().attr("datetime") ||
    itemOrUrl?.publishedAt ||
    null;

  const author =
    cleanText(
      $('meta[name="author"]').attr("content") ||
        $('[rel="author"]').first().text() ||
        $('[class*="author"]').first().text(),
    ) || null;

  const paragraphs = collectArticleParagraphs($);

  if (!headline || paragraphs.length === 0) return null;

  return {
    headline,
    body: paragraphs.join("\n"),
    paragraphCount: paragraphs.length,
    imageUrl,
    publishedAt,
    author,
    link: cleanLink,
  };
}

function collectArticleParagraphs($) {
  const selectorGroups = [
    "article p",
    '[itemprop="articleBody"] p',
    '[class*="article-content"] p',
    '[class*="story-content"] p',
    '[class*="content-body"] p',
    "main p",
  ];

  for (const selector of selectorGroups) {
    const paragraphs = [];
    const seen = new Set();

    $(selector).each((_, element) => {
      const text = cleanText($(element).text());
      if (!isUsefulParagraph(text)) return;
      if (seen.has(text)) return;
      seen.add(text);
      paragraphs.push(text);
    });

    if (paragraphs.length >= 2) return paragraphs;
  }

  return [];
}

function isUsefulParagraph(text) {
  if (!text || text.length < 45) return false;

  return !/(read more|read also|follow us|download the app|sign up|subscribe|advertisement|recommended for you|fantasy|dream11|live score|click here)/i.test(
    text,
  );
}

function cleanText(value = "") {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeImageUrl(value, baseUrl) {
  if (!value) return null;
  try {
    const url = new URL(value, baseUrl);
    url.hash = "";
    return url.toString();
  } catch {
    return value;
  }
}
