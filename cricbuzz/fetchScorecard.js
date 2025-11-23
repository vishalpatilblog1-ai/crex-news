// cricbuzz/fetchScorecard.js
import fetch from "node-fetch";
const BASE_URL = "https://cricbuzz-cricket.p.rapidapi.com";
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

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

// export async function fetchScorecard(matchId) {
//   const url = `https://m.cricbuzz.com/api/cricket-match/scorecard/${matchId}`;

//   try {
//     const res = await fetch(url, {
//       headers: {
//         "User-Agent": "Mozilla/5.0",
//         Accept: "application/json",
//       },
//     });

//     return await res.json();
//   } catch (err) {
//     return { error: "SCORECARD_FETCH_FAILED", message: err.message };
//   }
// }

export async function fetchScorecard(matchId) {
  const data = await await fetchJson(`${BASE_URL}/mcenter/v1/${matchId}/scard`);
  console.log(data);
  return data;
}
