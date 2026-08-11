// cricbuzz/cricbuzzApi.js
import fetch from "node-fetch";
import "dotenv/config";

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const BASE_URL = "https://crickbuzz-official-apis.p.rapidapi.com";
const RAPIDAPI_HOST = "crickbuzz-official-apis.p.rapidapi.com";

/* Helper to fetch JSON safely */
async function fetchJson(url) {
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "x-rapidapi-key": RAPIDAPI_KEY,
        "x-rapidapi-host": RAPIDAPI_HOST,
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json",
      },
    });

    return await res.json();
  } catch (err) {
    console.error("❌ Fetch JSON error:", err.message);
    return null;
  }
}

export async function getLiveMatches() {
  return await fetchJson(`${BASE_URL}/matches/v1/live`);
}

export async function getLiveNewsList() {
  // Postman-confirmed working endpoint for the new subscription: GET /news
  // (old /news/v1/index was the previous cricbuzz-cricket API's path)
  return await fetchJson(`${BASE_URL}/news`);
}
export async function getNewsDetailsByNewsId(newsId) {
  // ⚠️ NOT yet confirmed against the new API — /news/v1/detail/:id was the
  // OLD host's path. Verify the correct detail endpoint in Postman/RapidAPI
  // docs for "Crickbuzz Official APIs" and update this if it 404s.
  return await fetchJson(`${BASE_URL}/news/v1/detail/${newsId}`);
}

export async function findIndiaMatch() {
  const data = await getLiveMatches();

  if (!data?.typeMatches) return null;

  // Allowed international identifiers
  const INTERNATIONAL_KEYS = [
    "test",
    "odi",
    "t20",
    "t20i",
    "international",
    "one-day",
  ];

  // Domestic leagues to skip
  const BLOCKED_KEYS = [
    "premier",
    "league",
    "ipl",
    "ranji",
    "trophy",
    "cup",
    "shield",
    "smat",
    "syed mushtaq",
    "women",
    "u19",
    "u23",
    "lanka",
    "psl",
    "bbl",
    "super smash",
    "nepal",
  ];

  for (const block of data.typeMatches) {
    for (const series of block.seriesMatches || []) {
      const matches = series.seriesAdWrapper?.matches || [];

      for (const match of matches) {
        const info = match.matchInfo;
        if (!info) continue;

        const t1 = info.team1?.teamName?.toLowerCase() || "";
        const t2 = info.team2?.teamName?.toLowerCase() || "";
        const format = info.matchFormat?.toLowerCase() || "";
        const seriesName = info.seriesName?.toLowerCase() || "";

        const isIndia = t1.includes("india") || t2.includes("india");

        if (!isIndia) continue;

        const isBlocked = BLOCKED_KEYS.some((key) => seriesName.includes(key));

        if (isBlocked) continue;

        const isInternational = INTERNATIONAL_KEYS.some((key) =>
          format.includes(key),
        );

        if (!isInternational) continue;

        return {
          id: info.matchId,
          name: info.seriesName,
          format: info.matchFormat,
        };
      }
    }
  }

  return null;
}
export async function getBestImageUrl(imageId) {
  const cdnBase = "https://static.cricbuzz.com/a/img/v1/i1/c";
  const apiBase = "https://cricbuzz-cricket.p.rapidapi.com/img/v1/i1/c";

  const candidates = [
    `${cdnBase}${imageId}/o.jpg`,
    `${cdnBase}${imageId}/l.jpg`,
    `${apiBase}${imageId}/i.jpg`,
  ];

  for (const url of candidates) {
    try {
      const res = await axios.get(url, {
        responseType: "arraybuffer",
        validateStatus: (s) => s < 500,
      });

      if (res.status === 200) return url;
    } catch (err) {}
  }

  return null;
}

export async function getMatchScore(matchId) {
  const data = await await fetchJson(`${BASE_URL}/mcenter/v1/${matchId}/scard`);
  return data;
}

export async function getCommentary(matchId) {
  return await fetchJson(`${BASE_URL}/mcenter/v1/${matchId}/comm`);
}

export async function fetchNewsImageById(imageId) {
  return await fetchJson(`${BASE_URL}/img/v1/i1/c${imageId}/i.jpg`);
}
export async function fetchNewsPhotos() {
  return await fetchJson(`${BASE_URL}/photos/v1/index`);
}
export async function fetchNewsPhotoGallery() {
  return await fetchJson(`${BASE_URL}/photos/v1/detail/5374`);
}
