// findBestLiveMatch.js (RAILWAY SAFE VERSION)
import { getLiveMatches } from "./cricbuzz/getLiveMatches.js";

const PRIORITY = ["India", "India A", "India U19", "India Women"];

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
        if (state !== "live" && state !== "inprogress") continue;

        const obj = {
          id: info.matchId,
          name: `${info.team1.teamName} vs ${info.team2.teamName}`,
          team1: info.team1.teamName,
          team2: info.team2.teamName,
        };

        liveMatches.push(obj);
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

  // ⭐ Debug log all live matches
  liveMatches.forEach((m, i) => {
    console.log(`   ${i + 1}. ${m.name} (ID: ${m.id})`);
  });

  // ⭐ Priority sort
  liveMatches.sort((a, b) => {
    const aScore =
      (PRIORITY.includes(a.team1) ? PRIORITY.indexOf(a.team1) : 999) +
      (PRIORITY.includes(a.team2) ? PRIORITY.indexOf(a.team2) : 999);

    const bScore =
      (PRIORITY.includes(b.team1) ? PRIORITY.indexOf(b.team1) : 999) +
      (PRIORITY.includes(b.team2) ? PRIORITY.indexOf(b.team2) : 999);

    return aScore - bScore;
  });

  console.log(
    `✅ [findBestLiveMatch] Selected: ${liveMatches[0].name} (ID: ${liveMatches[0].id})`
  );

  return liveMatches[0];
}
