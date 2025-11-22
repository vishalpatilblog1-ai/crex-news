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

async function safeJson(res) {
  const text = await res.text();

  if (text.startsWith("<")) {
    return {
      error: "HTML_BLOCKED",
      html: text.slice(0, 200),
    };
  }

  try {
    return JSON.parse(text);
  } catch {
    return { error: "JSON_PARSE_FAILED", raw: text.slice(0, 100) };
  }
}

export async function fetchScorecard(matchId) {
  const url = `https://m.cricbuzz.com/api/cricket-match/scorecard/${matchId}`;
  const res = await fetch(url, { headers: MOBILE_HEADERS });
  return safeJson(res);
}

export async function fetchCommentary(matchId) {
  const url = `https://m.cricbuzz.com/api/cricket-match/commentary/${matchId}`;
  const res = await fetch(url, { headers: MOBILE_HEADERS });
  return safeJson(res);
}
