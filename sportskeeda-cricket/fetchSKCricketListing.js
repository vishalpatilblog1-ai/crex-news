import axios from "axios";

const REQUEST_TIMEOUT_MS = Number(process.env.SK_REQUEST_TIMEOUT_MS || 60000);
const SCRAPPEY_API_KEY = process.env.SCRAPPEY_API_KEY;
const SCRAPPEY_ENDPOINT = "https://publisher.scrappey.com/api/v1";

const LISTING_URLS = [
  "https://www.sportskeeda.com/cricket",
  "https://www.sportskeeda.com/cricket/news",
];

const ARTICLE_PATH_PREFIX = "/cricket/news-";
const ARTICLE_LINK_PATTERN = /\/cricket\/news-[a-z0-9-]+/gi;

async function fetchListingPage(url) {
  if (!SCRAPPEY_API_KEY) {
    throw new Error("SCRAPPEY_API_KEY is not set");
  }

  const { data } = await axios.post(
    SCRAPPEY_ENDPOINT,
    { cmd: "request.get", url },
    {
      params: { key: SCRAPPEY_API_KEY },
      timeout: REQUEST_TIMEOUT_MS,
      headers: { "Content-Type": "application/json" },
    },
  );

  const statusCode = data?.solution?.statusCode;
  const html = data?.solution?.response;

  if (!html || (statusCode && (statusCode < 200 || statusCode >= 400))) {
    throw new Error(
      `Scrappey fetch failed for ${url} (status: ${statusCode ?? "unknown"}, data: ${data?.data ?? "unknown"})`,
    );
  }

  return html;
}

function slugToHeadline(pathname) {
  return pathname.replace(ARTICLE_PATH_PREFIX, "").replace(/-/g, " ").trim();
}

function extractArticleCandidates(html) {
  const candidates = [];
  const seenPaths = new Set();

  const matches = html.match(ARTICLE_LINK_PATTERN) || [];

  for (const rawPath of matches) {
    const pathname = rawPath.toLowerCase();

    if (seenPaths.has(pathname)) continue;

    seenPaths.add(pathname);
    candidates.push({
      link: pathname,
      headline: slugToHeadline(pathname),
    });
  }

  return candidates;
}

export async function fetchSKCricketListing() {
  const candidateMap = new Map();

  for (const url of LISTING_URLS) {
    let html;

    try {
      html = await fetchListingPage(url);
    } catch (error) {
      console.log(
        `⚠️ Sportskeeda listing fetch failed (${url}):`,
        error?.message || error,
      );
      continue;
    }

    const candidates = extractArticleCandidates(html);

    for (const candidate of candidates) {
      if (!candidateMap.has(candidate.link)) {
        candidateMap.set(candidate.link, candidate);
      }
    }
  }

  return Array.from(candidateMap.values());
}

export default fetchSKCricketListing;
