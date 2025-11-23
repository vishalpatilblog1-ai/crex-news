import fetch from "node-fetch";

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const BASE_URL = "https://cricbuzz-cricket.p.rapidapi.com";

export async function getLiveMatches() {
  return await fetchJson(`${BASE_URL}/matches/v1/live`);
}

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
