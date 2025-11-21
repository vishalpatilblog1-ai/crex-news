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

export async function findTodayMatch() {
  try {
    const matches = await fetchTodayMatches(); // your existing api call

    if (!matches || matches.length === 0) {
      console.log("No matches returned by API.");
      return null;
    }

    // Fuzzy keyword matching for IND & SA in any order
    const isIndia = (name = "") =>
      /^(ind|india|bharat)$/i.test(name) || /ind/i.test(name);

    const isSA = (name = "") => /(sa|rsa|south africa)/i.test(name);

    for (const m of matches) {
      const teams = [
        m.team1?.name || "",
        m.team2?.name || "",
        ...(m.teams || []),
      ];

      const hasIndia = teams.some((t) => isIndia(t));
      const hasSA = teams.some((t) => isSA(t));

      if (hasIndia && hasSA) {
        console.log(`Match Detected: ${teams.join(" vs ")}`);
        return m.id;
      }
    }

    return null;
  } catch (err) {
    console.error("Error in findTodayMatch:", err);
    return null;
  }
}
