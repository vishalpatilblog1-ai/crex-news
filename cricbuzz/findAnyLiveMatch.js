// Finds ANY live match (T20, ODI, Test, tri-series — everything)
export async function findAnyLiveMatch() {
  const data = await getLiveMatches();
  if (!data?.typeMatches) return null;

  for (const block of data.typeMatches) {
    for (const series of block.seriesMatches || []) {
      const matches = series.seriesAdWrapper?.matches || [];

      for (const match of matches) {
        const info = match.matchInfo;
        if (!info) continue;

        // We only care if match is LIVE
        if (!info.state || info.state !== "inprogress") continue;

        return {
          id: info.matchId,
          name: `${info.team1.teamName} vs ${info.team2.teamName}`,
        };
      }
    }
  }

  return null;
}
