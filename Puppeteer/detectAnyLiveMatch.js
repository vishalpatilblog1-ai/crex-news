import { getLiveMatches } from "./api.js";

export async function findAnyLiveMatch() {
  const data = await getLiveMatches();
  if (!data?.typeMatches) return null;

  for (const block of data.typeMatches) {
    for (const series of block.seriesMatches || []) {
      const matches = series.seriesAdWrapper?.matches || [];

      for (const match of matches) {
        const info = match.matchInfo;
        if (!info) continue;

        // must be in progress or about to start
        const state = info.state || "";
        const live =
          state.toLowerCase() === "inprogress" ||
          state.toLowerCase() === "live" ||
          state.toLowerCase() === "mid" ||
          state.toLowerCase() === "running";

        if (live) {
          return {
            id: info.matchId,
            name: info.seriesName,
            teams: `${info.team1.teamName} vs ${info.team2.teamName}`,
            state,
          };
        }
      }
    }
  }

  return null;
}
