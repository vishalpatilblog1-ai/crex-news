// events.js — BEST version using currBatTeamId

let lastState = {
  runs: 0,
  wickets: 0,
  overs: 0,
};

export function detectEvents(matchData) {
  if (!matchData || !matchData.matchScore || !matchData.matchInfo) return null;

  const score = matchData.matchScore;
  const info = matchData.matchInfo;

  const batTeamId = info.currBatTeamId; // <-- KEY!

  // Determine which team's score we should read
  let innings = null;

  if (
    score.team1Score &&
    score.team1Score.inngs1 &&
    info.team1?.teamId === batTeamId
  )
    innings = score.team1Score.inngs1;

  if (
    score.team1Score &&
    score.team1Score.inngs2 &&
    info.team1?.teamId === batTeamId
  )
    innings = score.team1Score.inngs2;

  if (
    score.team1Score &&
    score.team1Score.inngs3 &&
    info.team1?.teamId === batTeamId
  )
    innings = score.team1Score.inngs3;

  if (
    score.team2Score &&
    score.team2Score.inngs1 &&
    info.team2?.teamId === batTeamId
  )
    innings = score.team2Score.inngs1;

  if (
    score.team2Score &&
    score.team2Score.inngs2 &&
    info.team2?.teamId === batTeamId
  )
    innings = score.team2Score.inngs2;

  if (
    score.team2Score &&
    score.team2Score.inngs3 &&
    info.team2?.teamId === batTeamId
  )
    innings = score.team2Score.inngs3;

  // If still null, fallback (rare cases)
  if (!innings) {
    innings =
      score.team1Score?.inngs1 ||
      score.team1Score?.inngs2 ||
      score.team2Score?.inngs1 ||
      score.team2Score?.inngs2;

    if (!innings) return null;
  }

  // Extract metrics
  const currRuns = innings.runs || 0;
  const currWkts = innings.wickets || 0;
  const currOvers = parseFloat(innings.overs || 0);

  const prev = { ...lastState };

  // Save for next tick
  lastState = {
    runs: currRuns,
    wickets: currWkts,
    overs: currOvers,
  };

  const runDiff = currRuns - prev.runs;

  // ---------------------------------------
  // WICKET detection
  // ---------------------------------------
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

  // ---------------------------------------
  // SIX detection
  // ---------------------------------------
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

  // ---------------------------------------
  // FOUR detection
  // ---------------------------------------
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

  // ---------------------------------------
  // OVER CHANGE
  // ---------------------------------------
  if (currOvers > prev.overs) {
    return {
      type: "OVER_CHANGE",
      runs: currRuns,
      wickets: currWkts,
      overs: currOvers,
    };
  }

  // ---------------------------------------
  // BREAKS (Lunch, Tea, Stumps)
  // ---------------------------------------
  const status = info.status?.toLowerCase() || "";

  console.log("status::", status);

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
