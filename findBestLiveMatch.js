// findBestLiveMatch.js (RAILWAY SAFE VERSION)
import { getLiveMatches } from "./cricbuzz/getLiveMatches.js";

const PRIORITY = ["India", "India A", "India U19", "India Women"];

// Normalize names for safer comparison
function norm(name) {
  return (name || "").toLowerCase().replace(/\./g, "").trim();
}

export async function findBestLiveMatch() {
  console.log("🔍 [findBestLiveMatch] Fetching live matches...");

  let data;
  try {
    data = await getLiveMatches();
  } catch (err) {
    console.log("❌ [findBestLiveMatch] ERROR while fetching:", err.message);
    return null;
  }

  if (!data || !data.typeMatches) {
    console.log("⚠️ [findBestLiveMatch] No typeMatches block returned.");
    return null;
  }

  const liveMatches = [];

  for (const block of data.typeMatches) {
    for (const series of block.seriesMatches || []) {
      const matches = series.seriesAdWrapper?.matches || [];

      for (const match of matches) {
        const info = match.matchInfo;
        if (!info) continue;

        const state = info.state?.toLowerCase() || "";
        if (!state.includes("live") && !state.includes("progress")) continue;

        liveMatches.push({
          id: info.matchId,
          name: `${info.team1.teamName} vs ${info.team2.teamName}`,
          team1: info.team1.teamName,
          team2: info.team2.teamName,
        });
      }
    }
  }

  console.log(
    `📡 [findBestLiveMatch] Total live matches found: ${liveMatches.length}`
  );

  if (liveMatches.length === 0) {
    console.log("❌ [findBestLiveMatch] No live match found.");
    return null;
  }

  liveMatches.forEach((m, i) => {
    console.log(`   ${i + 1}. ${m.name} (ID: ${m.id})`);
  });

  // ⭐ FIXED PRIORITY SORT (normalised)
  liveMatches.sort((a, b) => {
    const aScore =
      (PRIORITY.some((p) => norm(p) === norm(a.team1)) ? 0 : 999) +
      (PRIORITY.some((p) => norm(p) === norm(a.team2)) ? 0 : 999);

    const bScore =
      (PRIORITY.some((p) => norm(p) === norm(b.team1)) ? 0 : 999) +
      (PRIORITY.some((p) => norm(p) === norm(b.team2)) ? 0 : 999);

    return aScore - bScore;
  });

  console.log(
    `✅ [findBestLiveMatch] Selected: ${liveMatches[0].name} (ID: ${liveMatches[0].id})`
  );

  return liveMatches[0];
}
