// Puppeteer/findAnyLiveMatch.js
import fetch from "node-fetch";

const MOBILE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Mobile Safari/537.36",
  Accept: "application/json",
  Referer: "https://m.cricbuzz.com/",
  "X-Requested-With": "XMLHttpRequest",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
};

// PRIORITY ORDER
const PRIORITY = ["India", "India A", "India U19", "India Women"];

// Fetch all live matches
async function getLiveMatches() {
  const url = "https://m.cricbuzz.com/api/cricket-match/live";
  const res = await fetch(url, { headers: MOBILE_HEADERS });

  try {
    return await res.json();
  } catch (e) {
    return null;
  }
}

// Check if match belongs to a team category
function getMatchPriority(team1, team2) {
  const teams = [team1, team2];

  for (let i = 0; i < PRIORITY.length; i++) {
    if (
      teams.some((t) => t.toLowerCase().includes(PRIORITY[i].toLowerCase()))
    ) {
      return i; // lower index = higher priority
    }
  }

  return PRIORITY.length; // lowest priority
}

// Find highest priority live match
export async function findAnyLiveMatch() {
  const data = await getLiveMatches();
  if (!data?.typeMatches) return null;

  const liveMatches = [];

  for (const block of data.typeMatches) {
    for (const series of block.seriesMatches || []) {
      const matches = series.seriesAdWrapper?.matches || [];

      for (const match of matches) {
        const info = match.matchInfo;
        if (!info) continue;

        const state = info.state?.toLowerCase() || "";
        if (state === "inprogress" || state === "live") {
          const team1 = info.team1.teamName;
          const team2 = info.team2.teamName;

          liveMatches.push({
            id: info.matchId,
            name: `${team1} vs ${team2}`,
            priority: getMatchPriority(team1, team2),
            startTime: info.startDate, // optional tie-breaker
          });
        }
      }
    }
  }

  if (liveMatches.length === 0) return null;

  // Sort by priority → then by start time
  liveMatches.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return (a.startTime || 0) - (b.startTime || 0);
  });

  // Return best match
  return {
    id: liveMatches[0].id,
    name: liveMatches[0].name,
  };
}
