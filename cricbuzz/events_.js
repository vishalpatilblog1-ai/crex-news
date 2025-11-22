// events.js — NEW VERSION

let last = {
  ballId: null,
  runs: 0,
  wickets: 0,
  overs: 0,
  striker: "",
  nonStriker: "",
  bowler: "",
  partnership: 0,
  inningsKey: null,
  milestonePlayers: new Set(),
  partnershipMilestones: new Set(),
  tossTweeted: false,
  session: "",
};

export function detectEvents(data) {
  if (!data?.scorecard) return null;

  const innings = data.scorecard[0];
  if (!innings) return null;

  console.log("INNINGS KEYS:", Object.keys(innings));

  // Extract essential info
  const currRuns = innings.score;
  const currWkts = innings.wickets;
  const currOvers = parseFloat(innings.overs);
  const striker = innings.batsman?.[0]?.name || "";
  const nonStriker = innings.batsman?.[1]?.name || "";
  const bowler = innings.bowler?.[0]?.name || "";
  const lastBall = innings.recentBalls?.[0] || ""; // ← Critical: true event detection
  const ballId = `${currOvers}-${lastBall}`;

  // Build previous snapshot
  const prev = { ...last };

  // Initial setup
  if (!prev.inningsKey) {
    last = {
      ...last,
      ballId,
      runs: currRuns,
      wickets: currWkts,
      overs: currOvers,
      striker,
      nonStriker,
      bowler,
      inningsKey: "inn1",
    };
    return null;
  }

  // Toss detection (do once)
  if (!last.tossTweeted && data.toss) {
    last.tossTweeted = true;
    return {
      type: "TOSS",
      wonBy: data.toss.winner,
      decision: data.toss.decision,
    };
  }

  // Session detection
  const status = data.status?.toLowerCase() || "";
  if (status.includes("lunch") && last.session !== "LUNCH") {
    last.session = "LUNCH";
    return {
      type: "SESSION",
      session: "LUNCH",
      runs: currRuns,
      wkts: currWkts,
      overs: currOvers,
    };
  }
  if (status.includes("tea") && last.session !== "TEA") {
    last.session = "TEA";
    return {
      type: "SESSION",
      session: "TEA",
      runs: currRuns,
      wkts: currWkts,
      overs: currOvers,
    };
  }
  if (status.includes("stumps") && last.session !== "STUMPS") {
    last.session = "STUMPS";
    return {
      type: "SESSION",
      session: "STUMPS",
      runs: currRuns,
      wkts: currWkts,
      overs: currOvers,
    };
  }

  // Ball duplicate protection
  if (ballId === prev.ballId) return null;

  // Wicket detection from ball data
  if (lastBall === "W") {
    const dismissed = innings.lastWicket || {}; // Your API MUST include this
    last = {
      ...last,
      ballId,
      runs: currRuns,
      wickets: currWkts,
      overs: currOvers,
    };
    return {
      type: "WICKET",
      ...dismissed,
      runs: currRuns,
      wickets: currWkts,
      overs: currOvers,
    };
  }

  // SIX detection
  if (lastBall === "6") {
    last = { ...last, ballId, runs: currRuns };
    return {
      type: "SIX",
      striker,
      bowler,
      runs: currRuns,
      wickets: currWkts,
      overs: currOvers,
    };
  }

  // FOUR detection
  if (lastBall === "4") {
    last = { ...last, ballId, runs: currRuns };
    return {
      type: "FOUR",
      striker,
      bowler,
      runs: currRuns,
      wickets: currWkts,
      overs: currOvers,
    };
  }

  // Milestones
  for (const b of innings.batsman || []) {
    if (
      b.runs >= 50 &&
      b.runs % 50 === 0 &&
      !last.milestonePlayers.has(b.name)
    ) {
      last.milestonePlayers.add(b.name);
      return { type: "MILESTONE", player: b.name, runs: b.runs };
    }
  }

  // Winner
  if (data.matchWinner && !last.matchWinner) {
    last.matchWinner = data.matchWinner;
    return { type: "MATCH_END", winner: data.matchWinner };
  }

  // Update state
  last = {
    ...last,
    ballId,
    runs: currRuns,
    wickets: currWkts,
    overs: currOvers,
    striker,
    bowler,
  };

  return null;
}
