import "dotenv/config";

export async function getLiveMatches() {
  const apiKey = process.env.CRICKETDATA_API_KEY;
  const url = `https://api.cricapi.com/v1/currentMatches?apikey=${apiKey}`;

  try {
    const res = await fetch(url);
    const json = await res.json();

    if (!json || json.status !== "success") {
      console.log("❌ Cricket API error:", json);
      return [];
    }

    return json.data || [];
  } catch (err) {
    console.log("❌ Fetch failed, retrying:", err.message);
    return [];
  }
}
