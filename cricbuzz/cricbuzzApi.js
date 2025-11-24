// cricbuzz/cricbuzzApi.js
import fetch from "node-fetch";
import "dotenv/config";

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const BASE_URL = "https://cricbuzz-cricket.p.rapidapi.com";

/* Helper to fetch JSON safely */
async function fetchJson(url) {
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "x-rapidapi-key": RAPIDAPI_KEY,
        "x-rapidapi-host": "cricbuzz-cricket.p.rapidapi.com",
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

        // Reject domestic leagues or IPL-like tournaments
        const isBlocked = BLOCKED_KEYS.some((key) => seriesName.includes(key));

        if (isBlocked) continue;

        // Must match international formats
        const isInternational = INTERNATIONAL_KEYS.some((key) =>
          format.includes(key)
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

// export async function findIndiaMatch() {
//   const data = await getLiveMatches();

//   if (!data?.typeMatches) return null;

//   for (const block of data.typeMatches) {
//     for (const series of block.seriesMatches || []) {
//       const matches = series.seriesAdWrapper?.matches || [];

//       for (const match of matches) {
//         const info = match.matchInfo;
//         if (!info) continue;

//         const t1 = info.team1?.teamName?.toLowerCase() || "";
//         const t2 = info.team2?.teamName?.toLowerCase() || "";

//         const india = t1.includes("india") || t2.includes("india");
//         const sa =
//           t1.includes("south africa") ||
//           t2.includes("south africa") ||
//           t1.includes("rsa") ||
//           t2.includes("rsa");

//         if (india && sa) {
//           return {
//             id: info.matchId,
//             name: info.seriesName,
//           };
//         }
//       }
//     }
//   }

//   return null;
// }

export async function getMatchScore(matchId) {
  const data = await await fetchJson(`${BASE_URL}/mcenter/v1/${matchId}/scard`);
  return data;
}

export async function getCommentary(matchId) {
  return await fetchJson(`${BASE_URL}/mcenter/v1/${matchId}/comm`);
}
