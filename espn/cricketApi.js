import fetch from "node-fetch";

const SCOREBOARD_URL =
  "https://site.web.api.espn.com/apis/v2/sports/cricket/scoreboard";
const SUMMARY_URL =
  "https://site.web.api.espn.com/apis/v2/sports/cricket/summary";

async function callESPN(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`ESPN fetch error: ${res.status}`);
  }

  return res.json();
}

/**
 * 1) GET ALL LIVE MATCHES (scoreboard)
 */
export async function getLiveMatches() {
  console.log("SCOREBOARD_URL::", SCOREBOARD_URL);
  const data = await callESPN(SCOREBOARD_URL);
  return data.events || [];
}

/**
 * 2) FIND TODAY'S INDIA VS SOUTH AFRICA MATCH
 */
export async function findTodayMatch() {
  const events = await getLiveMatches();

  const match = events.find(
    (ev) =>
      ev.name?.toLowerCase().includes("india") &&
      ev.name?.toLowerCase().includes("south africa")
  );

  if (!match) return null;

  return {
    id: match.id,
    name: match.name,
  };
}

/**
 * 3) GET LIVE SCORE FOR A MATCH (summary endpoint)
 */
export async function getMatchScore(matchId) {
  const url = `${SUMMARY_URL}/${matchId}`;
  const data = await callESPN(url);

  const comp =
    data?.your?.competitions?.[0] ||
    data?.header?.competitions?.[0] ||
    data?.competitions?.[0];

  if (!comp) throw new Error("Invalid ESPN summary structure");

  return {
    id: matchId,
    name: comp?.notes?.[0]?.headline || data?.header?.gameNote || "Match",
    state: comp?.status?.type?.state, // "in", "post", "pre"
    detail: comp?.status?.type?.detail,
    teams: comp?.competitors?.map((c) => c.team?.name),
    score: comp?.score || [],
  };
}
