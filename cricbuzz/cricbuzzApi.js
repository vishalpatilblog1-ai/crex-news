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

/** 1️⃣ LIVE MATCHES */
export async function getLiveMatches() {
  return await fetchJson(`${BASE_URL}/matches/v1/live`);
}

/** 2️⃣ FIND INDIA vs SOUTH AFRICA MATCH */
export async function findIndiaMatch() {
  const data = await getLiveMatches();
  if (!data?.typeMatches) return null;

  for (const block of data.typeMatches) {
    for (const series of block.seriesMatches || []) {
      const matches = series.seriesAdWrapper?.matches || [];

      for (const match of matches) {
        const info = match.matchInfo;
        if (!info) continue;

        const t1 = info.team1?.teamName?.toLowerCase() || "";
        const t2 = info.team2?.teamName?.toLowerCase() || "";

        const india = t1.includes("india") || t2.includes("india");
        const sa =
          t1.includes("south africa") ||
          t2.includes("south africa") ||
          t1.includes("rsa") ||
          t2.includes("rsa");

        if (india && sa) {
          return {
            id: info.matchId,
            name: info.seriesName,
          };
        }
      }
    }
  }

  return null;
}

/** 3️⃣ SCORECARD */
export async function getMatchScore(matchId) {
  return await fetchJson(`${BASE_URL}/mcenter/v1/${matchId}`);
}

/** 4️⃣ COMMENTARY (optional) */
export async function getCommentary(matchId) {
  return await fetchJson(`${BASE_URL}/mcenter/v1/${matchId}/comm`);
}
