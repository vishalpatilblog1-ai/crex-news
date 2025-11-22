// events.js — rewritten for FREE Cricbuzz API (matches/v1/live)

let lastState = {
  runs: 0,
  wickets: 0,
  overs: 0,
};

export function detectEvents(matchData) {
  if (!matchData || !matchData.matchScore) return null;

  // Cricbuzz free structure
  const inngs =
    matchData.matchScore.team1Score?.inngs1 ||
    matchData.matchScore.team2Score?.inngs1;

  if (!inngs) return null;

  const currRuns = inngs.runs || 0;
  const currWkts = inngs.wickets || 0;
  const currOvers = parseFloat(inngs.overs || 0);

  const prev = { ...lastState };

  // Store new state for next comparison
  lastState = {
    runs: currRuns,
    wickets: currWkts,
    overs: currOvers,
  };

  const runDiff = currRuns - prev.runs;

  // -------------------------
  // WICKET
  // -------------------------
  if (currWkts > prev.wickets) {
    return {
      type: "WICKET",
      batsman: "Batsman",
      bowler: "Bowler",
      runs: currRuns,
      wickets: currWkts,
      overs: currOvers,
    };
  }

  // -------------------------
  // SIX
  // -------------------------
  if (runDiff === 6) {
    return {
      type: "SIX",
      batsman: "Batsman",
      bowler: "Bowler",
      runs: currRuns,
      wickets: currWkts,
      overs: currOvers,
    };
  }

  // -------------------------
  // FOUR
  // -------------------------
  if (runDiff === 4) {
    return {
      type: "FOUR",
      batsman: "Batsman",
      bowler: "Bowler",
      runs: currRuns,
      wickets: currWkts,
      overs: currOvers,
    };
  }

  // -------------------------
  // OVER CHANGE
  // -------------------------
  if (currOvers > prev.overs) {
    return {
      type: "OVER_CHANGE",
      runs: currRuns,
      wickets: currWkts,
      overs: currOvers,
    };
  }

  // -------------------------
  // BREAKS (Lunch, Tea, Stumps)
  // -------------------------
  const status = matchData.matchInfo?.status?.toLowerCase() || "";

  if (status.includes("lunch")) {
    return {
      type: "LUNCH",
      runs: currRuns,
      wickets: currWkts,
      overs: currOvers,
    };
  }

  if (status.includes("tea")) {
    return { type: "TEA", runs: currRuns, wickets: currWkts, overs: currOvers };
  }

  if (status.includes("stumps")) {
    return {
      type: "STUMPS",
      runs: currRuns,
      wickets: currWkts,
      overs: currOvers,
    };
  }

  return null;
}
