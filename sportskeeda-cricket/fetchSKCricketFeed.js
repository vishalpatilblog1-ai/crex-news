import Parser from "rss-parser";

const parser = new Parser({
  timeout: 20000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
      "AppleWebKit/537.36 (KHTML, like Gecko) " +
      "Chrome/150.0.0.0 Safari/537.36",
  },
});

const GOOGLE_NEWS_RSS_URL =
  "https://news.google.com/rss/search?q=site:sportskeeda.com+cricket&hl=en-IN&gl=IN&ceid=IN:en";

function cleanText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function normalizePublishedAt(value) {
  if (!value) return null;

  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return null;
  }

  return new Date(timestamp).toISOString();
}

function cleanGoogleNewsTitle(title = "") {
  return cleanText(title)
    .replace(/\s*-\s*Sportskeeda\s*$/i, "")
    .trim();
}

function isSportskeedaSource(item) {
  const sourceName = cleanText(
    item?.source?.content || item?.source || "",
  ).toLowerCase();

  const title = cleanText(item?.title || "").toLowerCase();

  return sourceName.includes("sportskeeda") || title.endsWith("- sportskeeda");
}

function isCricketHeadline(title = "") {
  const lowerTitle = cleanText(title).toLowerCase();

  const cricketTerms = [
    "cricket",
    "test",
    "odi",
    "t20",
    "ipl",
    "bcci",
    "icc",
    "wicket",
    "batter",
    "batsman",
    "bowler",
    "captain",
    "world cup",
    "champions trophy",
    "rohit sharma",
    "virat kohli",
    "shubman gill",
    "jasprit bumrah",
  ];

  return cricketTerms.some((term) => lowerTitle.includes(term));
}

export async function fetchSKCricketFeed({ limit = 50 } = {}) {
  const feed = await parser.parseURL(GOOGLE_NEWS_RSS_URL);

  const items = feed.items
    .filter(isSportskeedaSource)
    .map((item) => ({
      title: cleanGoogleNewsTitle(item.title),

      headline: cleanGoogleNewsTitle(item.title),

      googleNewsLink: item.link || item.guid || null,

      link: item.link || item.guid || null,

      publishedAt: normalizePublishedAt(item.isoDate || item.pubDate),

      source: cleanText(item?.source?.content || item?.source || "Sportskeeda"),
    }))
    .filter((item) => {
      return item.title && item.link && isCricketHeadline(item.title);
    })
    .sort((a, b) => {
      return Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0);
    })
    .slice(0, limit);

  return items;
}

export default fetchSKCricketFeed;
