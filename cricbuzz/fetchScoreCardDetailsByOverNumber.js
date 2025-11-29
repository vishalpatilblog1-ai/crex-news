export function fetchScoreCardDetailsByOverNumber(scorecardObject, overNum) {
  if (!scorecardObject || !Array.isArray(scorecardObject.scorecard)) {
    return [];
  }

  const targetOver = Number(overNum);

  // flatten all innings objects
  const allInnings = scorecardObject.scorecard;

  // Scorecard does NOT store per-ball logs, only final state per over.
  // But we can still filter by exact over number.
  const filtered = allInnings.filter((inn) => {
    if (typeof inn.overs === "undefined") return false;
    return Number(inn.overs) === targetOver;
  });

  // Safety sort by ball number (optional)
  filtered.sort((a, b) => (a.ballnbr || 0) - (b.ballnbr || 0));

  return filtered;
}
