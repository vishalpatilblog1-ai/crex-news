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

// Fetches all live series + matches
async function getLiveMatches() {
  const url = "https://m.cricbuzz.com/api/cricket-match/live";
  const res = await fetch(url, { headers: MOBILE_HEADERS });

  try {
    return await res.json();
  } catch (e) {
    return null;
  }
}

// Finds ANY live match happening right now
export async function findAnyLiveMatch() {
  const data = await getLiveMatches();
  if (!data?.typeMatches) return null;

  for (const block of data.typeMatches) {
    for (const series of block.seriesMatches || []) {
      const matches = series.seriesAdWrapper?.matches || [];

      for (const match of matches) {
        const info = match.matchInfo;
        if (!info) continue;

        // Only LIVE matches
        // state === "inprogress" or "live"
        const state = info.state?.toLowerCase() || "";

        if (state === "inprogress" || state === "live") {
          return {
            id: info.matchId,
            name: `${info.team1.teamName} vs ${info.team2.teamName}`,
          };
        }
      }
    }
  }

  return null;
}
