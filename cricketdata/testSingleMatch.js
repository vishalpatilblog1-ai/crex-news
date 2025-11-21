import "dotenv/config";

async function getMatch(matchId) {
  try {
    const apiKey = process.env.CRICKETDATA_API_KEY;

    if (!apiKey) {
      console.error("❌ Missing CRICKETDATA_API_KEY in .env");
      return;
    }

    if (!matchId) {
      console.error("❌ matchId is required");
      return;
    }

    const url = `https://api.cricapi.com/v1/match_info?apikey=${apiKey}&id=${matchId}`;

    console.log("🔍 Fetching match:", url);

    const res = await fetch(url);
    const json = await res.json();

    console.log("📌 Full Match Response:\n");
    console.log(JSON.stringify(json, null, 2));
  } catch (err) {
    console.error("❌ Error:", err);
  }
}

// 👉 Put any match ID here to test
getMatch("26691c2f-71cf-4732-8ef9-8d72cf22c544");
