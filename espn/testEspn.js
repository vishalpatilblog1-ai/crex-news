import fetch from "node-fetch";

async function getLiveMatches() {
  const url = "https://site.web.api.espn.com/apis/v2/sports/cricket/scoreboard";

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      Accept: "application/json",
    },
  });

  try {
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("❌ Could not parse JSON!");
    const text = await res.text();
    console.log(text);
  }
}

getLiveMatches();
