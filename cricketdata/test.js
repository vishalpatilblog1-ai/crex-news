import "dotenv/config";

async function getAllMatches() {
  try {
    const apiKey = process.env.CRICKETDATA_API_KEY;

    if (!apiKey) {
      console.error("❌ Missing CRICKETDATA_API_KEY in .env");
      return;
    }

    const url = `https://api.cricapi.com/v1/matches?apikey=${apiKey}`;

    const res = await fetch(url);

    if (!res.ok) {
      console.error("❌ API Error:", res.status, res.statusText);
      return;
    }

    const json = await res.json();

    if (!json.data) {
      console.error("❌ No data found:", json);
      return;
    }

    console.log("\n✅ Fetched Matches:\n");
    console.log(JSON.stringify(json.data, null, 2));
  } catch (err) {
    console.error("❌ Error:", err);
  }
}

getAllMatches();
