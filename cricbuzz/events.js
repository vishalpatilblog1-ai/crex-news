// events.js
let last = {
  runs: 0,
  wickets: 0,
  overs: 0,
  inningsKey: null,
};

export function detectEvents(data) {
  if (!data?.scorecard) return null;

  const innings = data.scorecard[0];
  if (!innings) return null;

  const currRuns = innings.score;
  const currWkts = innings.wickets;
  const currOvers = parseFloat(innings.overs);

  const key = "inn1"; // simple for 1st innings only (Test Day 1)

  const prev = { ...last };

  // first time
  if (!prev.inningsKey) {
    last = {
      runs: currRuns,
      wickets: currWkts,
      overs: currOvers,
      inningsKey: key,
    };
    return null;
  }

  // innings change
  if (key !== prev.inningsKey) {
    last = {
      runs: currRuns,
      wickets: currWkts,
      overs: currOvers,
      inningsKey: key,
    };
    return { type: "INNINGS_CHANGE" };
  }

  const runDiff = currRuns - prev.runs;
  const wktDiff = currWkts - prev.wickets;
  const overDiff = currOvers - prev.overs;

  // ----------------------------
  // SESSION TWEETS
  // ----------------------------
  const status = data.status?.toLowerCase() || "";

  if (status.includes("lunch")) return { type: "SESSION", session: "LUNCH" };
  if (status.includes("tea")) return { type: "SESSION", session: "TEA" };
  if (status.includes("stumps")) return { type: "SESSION", session: "STUMPS" };

  // ----------------------------
  // MILESTONES (BATTER)
  // ----------------------------
  for (const b of innings.batsman || []) {
    if (b.runs === 50) return { type: "MILESTONE", player: b.name, runs: 50 };
    if (b.runs === 100) return { type: "MILESTONE", player: b.name, runs: 100 };
    if (b.runs === 150) return { type: "MILESTONE", player: b.name, runs: 150 };
    if (b.runs === 200) return { type: "MILESTONE", player: b.name, runs: 200 };
  }

  // ----------------------------
  // WICKET
  // ----------------------------
  if (wktDiff === 1) {
    last = {
      runs: currRuns,
      wickets: currWkts,
      overs: currOvers,
      inningsKey: key,
    };
    return {
      type: "WICKET",
      runs: currRuns,
      wickets: currWkts,
      overs: currOvers,
    };
  }

  // ----------------------------
  // SIX
  // ----------------------------
  if (runDiff >= 6 && runDiff <= 8) {
    last = {
      runs: currRuns,
      wickets: currWkts,
      overs: currOvers,
      inningsKey: key,
    };
    return { type: "SIX", runs: currRuns, wickets: currWkts, overs: currOvers };
  }

  // ----------------------------
  // FOUR
  // ----------------------------
  if (runDiff >= 4 && runDiff <= 5) {
    last = {
      runs: currRuns,
      wickets: currWkts,
      overs: currOvers,
      inningsKey: key,
    };
    return {
      type: "FOUR",
      runs: currRuns,
      wickets: currWkts,
      overs: currOvers,
    };
  }

  // update state
  last = {
    runs: currRuns,
    wickets: currWkts,
    overs: currOvers,
    inningsKey: key,
  };
  return null;
}
