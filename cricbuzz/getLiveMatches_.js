// cricbuzz/getLiveMatches.js
import fetch from "node-fetch";

const MOBILE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 (KHTML, like Gecko)",
  Accept: "application/json",
  "X-Requested-With": "XMLHttpRequest",
};

export async function getLiveMatches() {
  const url = "https://m.cricbuzz.com/api/cricket-match/live";

  try {
    const res = await fetch(url, { headers: MOBILE_HEADERS });

    const data = await res.json();
    return data;
  } catch (err) {
    return { error: "LIVE_MATCH_FETCH_FAILED", message: err.message };
  }
}
