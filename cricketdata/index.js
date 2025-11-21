import "dotenv/config";

const BASE_URL = "https://api.cricapi.com/v1";
const API_KEY = process.env.CRICKETDATA_API_KEY;

// if (!API_KEY) {
//   console.error("❌ CRICKETDATA_API_KEY missing in .env");
// }

/**
 * Helper to call CricketData API
 */
async function callCricketApi(path, params = {}) {
  if (!API_KEY) throw new Error("CRICKETDATA_API_KEY missing");

  const url = new URL(`${BASE_URL}/${path}`);
  url.searchParams.set("apikey", API_KEY);

  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Cricket API error: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();

  if (json.status !== "success") {
    throw new Error(`Cricket API returned status=${json.status}`);
  }

  return json;
}

/**
 * Get all matches (past + upcoming around now)
 */
export async function getAllMatches() {
  const json = await callCricketApi("matches");
  return json.data || [];
}

/**
 * Get detailed info (score, status, etc) for one match
 */
export async function getMatchInfo(matchId) {
  const json = await callCricketApi("match_info", { id: matchId });
  return json.data;
}

/**
 * Try to find today's India vs South Africa match
 */
export async function findTodayIndVsSaMatch() {
  const matches = await getAllMatches();

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // Normalize helper
  const norm = (s) => s?.toLowerCase().trim();

  const target = matches.find((m) => {
    if (!m.teams || !Array.isArray(m.teams)) return false;

    const t1 = norm(m.teams[0]);
    const t2 = norm(m.teams[1]);

    const hasInd = t1?.includes("india") || t2?.includes("india");
    const hasSa =
      t1?.includes("south africa") ||
      t1 === "rsa" ||
      t2?.includes("south africa") ||
      t2 === "rsa";

    const isToday = m.date === today;

    return hasInd && hasSa && isToday;
  });

  return target || null;
}
