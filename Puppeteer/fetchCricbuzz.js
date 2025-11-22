import fetch from "node-fetch";

const headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  Referer: "https://m.cricbuzz.com/",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  Connection: "keep-alive",
};

async function safeJson(res) {
  const text = await res.text();

  if (text.startsWith("<")) {
    console.log("❌ HTML received instead of JSON");
    console.log(text.slice(0, 200));
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (e) {
    console.log("❌ JSON parse error:", e.message);
    return null;
  }
}

export async function fetchCommentary(matchId) {
  const url = `https://m.cricbuzz.com/api/cricket-match/commentary/${matchId}`;
  const res = await fetch(url, { headers });
  return safeJson(res);
}

export async function fetchScorecard(matchId) {
  const url = `https://m.cricbuzz.com/api/cricket-match/scorecard/${matchId}`;
  const res = await fetch(url, { headers });
  return safeJson(res);
}
