// x-news-cricket/fetchXNewsCricket.js
//
// Calls X's native News Search endpoint (GET /2/news/search) and returns
// normalized cricket story candidates. This replaces third-party scraping
// (Sportskeeda/CricketAddictor) with X's own Grok-summarized news-cluster
// feed. Auth is app-only (Bearer Token), NOT the OAuth1 posting keys.
//
// Docs: https://docs.x.com/x-api/news/introduction
// Pricing: undocumented as of testing (Aug 2026) — empirically billed at
// ~$0.006/unique story returned, deduplicated within a 24h UTC window,
// same mechanism as Post/User reads.

const NEWS_SEARCH_ENDPOINT = "https://api.x.com/2/news/search";

const DEFAULT_QUERY = "cricket";
const DEFAULT_MAX_RESULTS = Number(process.env.XNEWS_MAX_RESULTS || 3);
const DEFAULT_MAX_AGE_HOURS = Number(process.env.XNEWS_MAX_AGE_HOURS || 1);

const NEWS_FIELDS = "contexts,hook,summary,cluster_posts_results";

function getBearerToken() {
  const token = process.env.X_NEWS_BEARER_TOKEN || process.env.X_BEARER_TOKEN;
  if (!token) {
    throw new Error(
      "Missing X_NEWS_BEARER_TOKEN (or X_BEARER_TOKEN) env var — this is the app-only Bearer Token from the gullypoint_ppu_prod app, separate from the OAuth1 posting keys.",
    );
  }
  return token;
}

/**
 * Fetch recent cricket news stories from X's News Search API.
 *
 * @param {Object} options
 * @param {string} [options.query] - free-text search query
 * @param {number} [options.maxResults] - 1-100, resources billed = count returned
 * @param {number} [options.maxAgeHours] - lookback window (decimals allowed, e.g. 0.25 = 15min)
 * @returns {Promise<{ candidates: object[], failures: object[] }>}
 */
export async function fetchXNewsCricket({
  query = DEFAULT_QUERY,
  maxResults = DEFAULT_MAX_RESULTS,
  maxAgeHours = DEFAULT_MAX_AGE_HOURS,
} = {}) {
  const bearerToken = getBearerToken();

  // max_age_hours must be a whole integer — the endpoint rejected 0.25
  // with a 400 "not a valid Int" error in testing, even though an earlier
  // manual curl with the same decimal value was accepted. Undocumented
  // endpoint, inconsistent validation — don't trust decimals, round up.
  const safeMaxAgeHours = Math.max(1, Math.ceil(maxAgeHours));

  const url = new URL(NEWS_SEARCH_ENDPOINT);
  url.searchParams.set("query", query);
  url.searchParams.set("max_results", String(maxResults));
  url.searchParams.set("max_age_hours", String(safeMaxAgeHours));
  url.searchParams.set("news.fields", NEWS_FIELDS);

  let response;

  try {
    response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${bearerToken}` },
    });
  } catch (error) {
    return {
      candidates: [],
      failures: [
        { category: "network", message: error?.message || String(error) },
      ],
    };
  }

  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    return {
      candidates: [],
      failures: [
        {
          category: response.status === 429 ? "rate_limit" : "http_error",
          message: `X News Search returned ${response.status}: ${bodyText.slice(0, 300)}`,
        },
      ],
    };
  }

  let json;
  try {
    json = await response.json();
  } catch (error) {
    return {
      candidates: [],
      failures: [
        { category: "parse_error", message: error?.message || String(error) },
      ],
    };
  }

  const stories = Array.isArray(json?.data) ? json.data : [];
  const candidates = stories.map(normalizeStory).filter(Boolean);

  return { candidates, failures: [] };
}

function normalizeStory(story) {
  if (!story?.id || !story?.name) return null;

  const teams = story?.contexts?.sports?.teams || [];
  const people = story?.contexts?.entities?.people || [];
  const topics = story?.contexts?.topics || [];

  return {
    newsId: story.id,
    headline: story.name,
    hook: story.hook || "",
    summary: story.summary || "",
    teams,
    people,
    topics,
    clusterPostIds: (story.cluster_posts_results || []).map((p) => p.post_id),
    updatedAt: story.updated_at || null,
  };
}
