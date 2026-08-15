import axios from "axios";

const REQUEST_TIMEOUT_MS = Number(process.env.SK_REQUEST_TIMEOUT_MS || 80000);
const SCRAPPEY_API_KEY = process.env.SCRAPPEY_API_KEY;
const SCRAPPEY_ENDPOINT = "https://publisher.scrappey.com/api/v1";

const LISTING_URLS = [
  "https://www.sportskeeda.com/cricket",
  "https://www.sportskeeda.com/cricket/news",
];

const ARTICLE_PATH_PREFIX = "/cricket/news-";

const CARD_PATTERN =
  /<a href="(\/cricket\/news-[a-z0-9-]+)"[^>]*aria-label="([^"]*)"[^>]*><\/a>[\s\S]*?fi--timestamp-text">\s*([^<]+?)\s*<\/div>/gi;

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

async function fetchListingPage(url) {
  if (!SCRAPPEY_API_KEY) {
    throw new Error("SCRAPPEY_API_KEY is not set");
  }

  let response;

  try {
    response = await axios.post(
      SCRAPPEY_ENDPOINT,
      { cmd: "request.get", url },
      {
        params: { key: SCRAPPEY_API_KEY },
        timeout: REQUEST_TIMEOUT_MS,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const wrapped = new Error(
      `Scrappey request failed for ${url}: ${error.message}`,
    );
    wrapped.category = classifyFetchFailure(error, null, null);
    throw wrapped;
  }

  const { data } = response;
  const statusCode = data?.solution?.statusCode;
  const html = data?.solution?.response;

  if (!html || (statusCode && (statusCode < 200 || statusCode >= 400))) {
    const wrapped = new Error(
      `Scrappey fetch failed for ${url} (status: ${statusCode ?? "unknown"}, data: ${data?.data ?? "unknown"})`,
    );
    wrapped.category = classifyFetchFailure(null, statusCode, data?.data);
    throw wrapped;
  }

  return html;
}

function decodeHtmlEntities(value = "") {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function parseRelativeAge(text = "") {
  const normalized = text.trim().toLowerCase();

  if (/^just now$/.test(normalized)) {
    return 0;
  }

  const minMatch = normalized.match(/^(\d+)\s*min/);
  if (minMatch) {
    return Number(minMatch[1]);
  }

  const hrMatch = normalized.match(/^(\d+)\s*hr/);
  if (hrMatch) {
    return Number(hrMatch[1]) * 60;
  }

  const dayMatch = normalized.match(/^(\d+)\s*d(ay)?/);
  if (dayMatch) {
    return Number(dayMatch[1]) * 60 * 24;
  }

  return null;
}

function extractArticleCandidates(html) {
  const candidates = [];
  const seenPaths = new Set();

  for (const match of html.matchAll(CARD_PATTERN)) {
    const pathname = match[1].toLowerCase();

    if (seenPaths.has(pathname)) continue;
    seenPaths.add(pathname);

    const headline = decodeHtmlEntities(match[2] || "").trim();
    const ageMinutes = parseRelativeAge(match[3] || "");

    candidates.push({
      link: pathname,
      headline,
      ageMinutes,
    });
  }

  return candidates;
}

export async function fetchSKCricketListing() {
  const candidateMap = new Map();
  const failures = [];

  for (const url of LISTING_URLS) {
    let html;

    try {
      html = await fetchListingPage(url);
    } catch (error) {
      console.log(
        `⚠️ Sportskeeda listing fetch failed (${url}):`,
        error?.message || error,
      );
      failures.push({ url, category: error?.category || "other" });
      continue;
    }

    const candidates = extractArticleCandidates(html);

    for (const candidate of candidates) {
      if (!candidateMap.has(candidate.link)) {
        candidateMap.set(candidate.link, candidate);
      }
    }
  }

  return {
    candidates: Array.from(candidateMap.values()),
    failures,
  };
}

export default fetchSKCricketListing;
