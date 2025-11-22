// Puppeteer/cricbuzzBridge.js
import fetch from "node-fetch";

const BASE = "https://www.cricbuzz.com/api/cricket-match";

// Commentary fetcher
export async function fetchCommentary(matchId) {
  const url = `${BASE}/${matchId}/commentary`;

  const res = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0",
    },
  });

  if (!res.ok) throw new Error("Failed to fetch commentary");

  return res.json();
}

// Scorecard fetcher
export async function fetchScorecard(matchId) {
  const url = `${BASE}/${matchId}/scorecard`;

  const res = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0",
    },
  });

  if (!res.ok) throw new Error("Failed to fetch scorecard");

  return res.json();
}

export default {
  fetchCommentary,
  fetchScorecard,
};
