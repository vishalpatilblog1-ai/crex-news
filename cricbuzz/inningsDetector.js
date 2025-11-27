// inningsDetector.js

export function detectFour(prev, curr) {
  if (!prev || !curr) return null;

  const prevMap = {};
  prev.batsman?.forEach((b) => (prevMap[b.id] = b.fours));

  for (const bat of curr.batsman || []) {
    const before = prevMap[bat.id] ?? bat.fours;
    if (bat.fours > before) {
      return {
        type: "FOUR",
        batterId: bat.id,
        batterName: bat.name,
        runs: bat.runs,
        balls: bat.balls,
      };
    }
  }
  return null;
}

export function detectSix(prev, curr) {
  if (!prev || !curr) return null;

  const prevMap = {};
  prev.batsman?.forEach((b) => (prevMap[b.id] = b.sixes));

  for (const bat of curr.batsman || []) {
    const before = prevMap[bat.id] ?? bat.sixes;
    if (bat.sixes > before) {
      return {
        type: "SIX",
        batterId: bat.id,
        batterName: bat.name,
        runs: bat.runs,
        balls: bat.balls,
      };
    }
  }
  return null;
}

export function detectMilestone(prev, curr) {
  if (!prev || !curr) return null;

  const prevMap = {};
  prev.batsman?.forEach((b) => (prevMap[b.id] = b.runs));

  for (const bat of curr.batsman || []) {
    const before = prevMap[bat.id] ?? bat.runs;

    if (before < 50 && bat.runs >= 50 && bat.runs < 100) {
      return {
        type: "FIFTY",
        batterName: bat.name,
        runs: bat.runs,
        balls: bat.balls,
      };
    }

    if (before < 100 && bat.runs >= 100) {
      return {
        type: "HUNDRED",
        batterName: bat.name,
        runs: bat.runs,
        balls: bat.balls,
      };
    }
  }
  return null;
}

export function detectPartnership(prev, curr) {
  if (!prev || !curr) return null;

  const prevP = prev.partnership?.partnership || [];
  const currP = curr.partnership?.partnership || [];

  const prevActive = prevP[prevP.length - 1];
  const currActive = currP[currP.length - 1];

  if (!prevActive || !currActive) return null;

  const isNewPair =
    prevActive.bat1id !== currActive.bat1id ||
    prevActive.bat2id !== currActive.bat2id;

  if (isNewPair) {
    return {
      type: "NEW_PARTNERSHIP",
      bat1: currActive.bat1name,
      bat2: currActive.bat2name,
      runs: currActive.totalruns,
      balls: currActive.totalballs,
    };
  }

  if (currActive.totalruns > prevActive.totalruns) {
    return {
      type: "PARTNERSHIP_UPDATED",
      bat1: currActive.bat1name,
      bat2: currActive.bat2name,
      runs: currActive.totalruns,
      balls: currActive.totalballs,
    };
  }

  return null;
}

export function detectWicket(prev, curr) {
  if (!prev || !curr) return null;

  if ((curr.wickets ?? 0) > (prev.wickets ?? 0)) {
    const prevActive = prev.batsman?.filter((b) => b.outdec === "batting");
    const currActive = curr.batsman?.filter((b) => b.outdec === "batting");

    const prevIds = new Set(prevActive.map((b) => b.id));
    const currIds = new Set(currActive.map((b) => b.id));

    for (const id of prevIds) {
      if (!currIds.has(id)) {
        const outBatter = prev.batsman.find((b) => b.id === id);
        return {
          type: "WICKET",
          batterName: outBatter?.name || "Unknown",
          howOut: outBatter?.outdec || "",
          score: curr.score,
          wickets: curr.wickets,
          overs: curr.overs,
        };
      }
    }
  }

  return null;
}
