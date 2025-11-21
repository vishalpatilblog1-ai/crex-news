import "dotenv/config";

async function getAllMatches() {
  const apiKey = process.env.CRICKETDATA_API_KEY;

  //   if (!apiKey) {
  //     console.error("❌ CRICKETDATA_API_KEY missing in .env");
  //     return;
  //   }

  const url = `https://api.cricapi.com/v1/matches?apikey=${apiKey}`;

  try {
    const res = await fetch(url);

    if (!res.ok) {
      console.error("❌ API Error:", res.status, res.statusText);
      return;
    }

    const json = await res.json();

    console.log(JSON.stringify(json.data, null, 2));
  } catch (err) {
    console.error("❌ Fetch failed:", err);
  }
}

getAllMatches();
