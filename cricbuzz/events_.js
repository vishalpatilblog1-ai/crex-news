// events.js — Scoreboard-only event detection (NO commentary, ZERO false positives)

let lastState = {
  runs: 0,
  wickets: 0,
  overs: 0,
  inningsKey: null, // store inning identifier so we detect innings change
};

export function detectEvents(matchData) {
  if (!matchData || !matchData.matchScore || !matchData.matchInfo) return null;

  const score = matchData.matchScore;
  const info = matchData.matchInfo;

  // ------------------------------------------------------
  // IDENTIFY CURRENT INNINGS STRICTLY USING currBatTeamId
  // ------------------------------------------------------

  const batTeamId = info.currBatTeamId;
  let innings = null;
  let inningsKey = null;

  function check(team, inngsName, data) {
    if (data && team?.teamId === batTeamId) {
      return { obj: data, key: `${team.teamId}-${inngsName}` };
    }
    return null;
  }

  // team1 innings
  const t1i1 = check(info.team1, "i1", score.team1Score?.inngs1);
  const t1i2 = check(info.team1, "i2", score.team1Score?.inngs2);
  const t1i3 = check(info.team1, "i3", score.team1Score?.inngs3);

  // team2 innings
  const t2i1 = check(info.team2, "i1", score.team2Score?.inngs1);
  const t2i2 = check(info.team2, "i2", score.team2Score?.inngs2);
  const t2i3 = check(info.team2, "i3", score.team2Score?.inngs3);

  const candidates = [t1i1, t1i2, t1i3, t2i1, t2i2, t2i3].filter(Boolean);

  if (candidates.length > 0) {
    innings = candidates[0].obj;
    inningsKey = candidates[0].key;
  }

  // fallback if nothing found (rare)
  if (!innings) return null;

  // ------------------------------------------------------
  // EXTRACT CURRENT METRICS SAFELY
  // ------------------------------------------------------

  const currRuns = Number(innings.runs || 0);
  const currWickets = Number(innings.wickets || 0);
  const currOvers = parseFloat(innings.overs || 0);

  const prev = { ...lastState };

  // FIRST EVENT — ignore because prev is zero
  if (prev.inningsKey === null) {
    lastState = {
      runs: currRuns,
      wickets: currWickets,
      overs: currOvers,
      inningsKey,
    };
    return null;
  }

  // ------------------------------------------------------
  // INNINGS CHANGE DETECTION
  // ------------------------------------------------------
  if (inningsKey !== prev.inningsKey) {
    lastState = {
      runs: currRuns,
      wickets: currWickets,
      overs: currOvers,
      inningsKey,
    };

    return {
      type: "INNINGS_CHANGE",
      teamId: batTeamId,
      runs: currRuns,
      wickets: currWickets,
      overs: currOvers,
    };
  }

  const runDiff = currRuns - prev.runs;
  const wktDiff = currWickets - prev.wickets;
  const overDiff = currOvers - prev.overs;

  // ------------------------------------------------------
  // WICKET
  // ------------------------------------------------------
  if (wktDiff === 1) {
    lastState = {
      runs: currRuns,
      wickets: currWickets,
      overs: currOvers,
      inningsKey,
    };
    return {
      type: "WICKET",
      runs: currRuns,
      wickets: currWickets,
      overs: currOvers,
    };
  }

  // ------------------------------------------------------
  // SIX (runs jumped by 6, 7, 8 due to extras)
  // ------------------------------------------------------
  if (runDiff >= 6 && runDiff < 10) {
    lastState = {
      runs: currRuns,
      wickets: currWickets,
      overs: currOvers,
      inningsKey,
    };
    return {
      type: "SIX",
      runs: currRuns,
      wickets: currWickets,
      overs: currOvers,
    };
  }

  // ------------------------------------------------------
  // FOUR (runs jumped by 4 or 5 due to extras)
  // ------------------------------------------------------
  if (runDiff >= 4 && runDiff < 6) {
    lastState = {
      runs: currRuns,
      wickets: currWickets,
      overs: currOvers,
      inningsKey,
    };
    return {
      type: "FOUR",
      runs: currRuns,
      wickets: currWickets,
      overs: currOvers,
    };
  }

  // ------------------------------------------------------
  // OVER CHANGE
  // ------------------------------------------------------
  if (overDiff > 0) {
    lastState = {
      runs: currRuns,
      wickets: currWickets,
      overs: currOvers,
      inningsKey,
    };
    return {
      type: "OVER_CHANGE",
      runs: currRuns,
      wickets: currWickets,
      overs: currOvers,
    };
  }

  // ------------------------------------------------------
  // NO EVENT
  // ------------------------------------------------------
  lastState = {
    runs: currRuns,
    wickets: currWickets,
    overs: currOvers,
    inningsKey,
  };
  return null;
}
