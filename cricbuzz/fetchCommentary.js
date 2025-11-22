// cricbuzz/fetchCommentary.js
import fetch from "node-fetch";

export async function fetchCommentary(matchId) {
  const url = `https://m.cricbuzz.com/api/cricket-match/commentary/${matchId}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json",
      },
    });

    return await res.json();
  } catch (err) {
    return { error: "COMMENTARY_FETCH_FAILED", message: err.message };
  }
}
