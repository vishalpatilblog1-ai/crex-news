import fetch from "node-fetch";
import "dotenv/config";

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

export async function getLiveMatches() {
  const url = "https://cricbuzz-cricket.p.rapidapi.com/mcenter/v1/live";

  const options = {
    method: "GET",
    headers: {
      "x-rapidapi-key": RAPIDAPI_KEY,
      "x-rapidapi-host": "cricbuzz-cricket.p.rapidapi.com",
    },
  };

  try {
    const res = await fetch(url, options);
    const data = await res.json();
    return data;
  } catch (err) {
    console.error("❌ Fetch error:", err);
    return null;
  }
}
