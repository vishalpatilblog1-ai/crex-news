// sportskeeda-cricket/parseSKArticle.js
import axios from "axios";
import * as cheerio from "cheerio";

import { normalizeSKLink } from "./skFilters.js";

const REQUEST_TIMEOUT_MS = Number(process.env.SK_REQUEST_TIMEOUT_MS || 60000);

const SCRAPPEY_API_KEY = process.env.SCRAPPEY_API_KEY;
const SCRAPPEY_ENDPOINT = "https://publisher.scrappey.com/api/v1";

function classifyFetchFailure(error, statusCode, scrappeyData) {
  if (error?.code === "ECONNABORTED" || /timeout/i.test(error?.message || "")) {
    return "timeout";
  }

  if (statusCode === 407) {
    return "scrappey_proxy";
  }

  if (
    (statusCode === 403 || statusCode === 405) &&
    scrappeyData === "success"
  ) {
    return "sk_waf_block";
  }

  return "other";
}

export async function parseSKArticle(itemOrUrl) {
  const link =
    typeof itemOrUrl === "string"
      ? itemOrUrl
      : itemOrUrl?.link || itemOrUrl?.url;

  if (!link) return null;

  const cleanLink = normalizeSKLink(link);

  if (!SCRAPPEY_API_KEY) {
    throw new Error(
      "SCRAPPEY_API_KEY is not set -- SK article fetches must be routed through Scrappey since Railway's IP range is blocked directly by SportsKeeda's WAF.",
    );
  }

  let response;

  try {
    response = await axios.post(
      SCRAPPEY_ENDPOINT,
      {
        cmd: "request.get",
        url: cleanLink,
      },
      {
        params: {
          key: SCRAPPEY_API_KEY,
        },
        timeout: REQUEST_TIMEOUT_MS,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    const wrapped = new Error(
      `Scrappey request failed for ${cleanLink}: ${error.message}`,
    );
    wrapped.category = classifyFetchFailure(error, null, null);
    throw wrapped;
  }

  const { data } = response;
  const statusCode = data?.solution?.statusCode;
  const html = data?.solution?.response;

  if (!html || (statusCode && (statusCode < 200 || statusCode >= 400))) {
    const wrapped = new Error(
      `Scrappey fetch failed for ${cleanLink} (status: ${statusCode ?? "unknown"}, data: ${data?.data ?? "unknown"})`,
    );
    wrapped.category = classifyFetchFailure(null, statusCode, data?.data);
    throw wrapped;
  }

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
