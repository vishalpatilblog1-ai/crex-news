import fetch from "node-fetch";

const url = "https://m.cricbuzz.com/api/cricket-match/scorecard/134425";

const headers = {
  "User-Agent": "Mozilla/5.0 (Linux; Android 11)",
  Accept: "application/json",
  Referer: "https://m.cricbuzz.com/",
};

(async () => {
  try {
    const res = await fetch(url, { headers });
    const text = await res.text();
    console.log("RESULT:");
    console.log(text.slice(0, 400)); // print first 400 chars
  } catch (err) {
    console.error("ERROR:", err.message);
  }
})();
