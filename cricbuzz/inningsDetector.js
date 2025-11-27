// inningsDetector.js

import {
  BATSMAN_MILESTONE_RUNS,
  BOWLER_MILESTONE_WICKETS,
  EVENT_TYPES,
  PARTNERSHIP_MILESTONE_RUNS,
} from "../utils/constants.js";

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
      type: EVENT_TYPES.PARTNERSHIP_UPDATED,
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
  if (!curr.fow || !curr.fow.fow) return null;

  const prevFowList = prev.fow?.fow || [];
  const currFowList = curr.fow.fow;

  if (currFowList.length === prevFowList.length) return null;

  const newFow = currFowList[currFowList.length - 1];

  const batterName = newFow?.batsmanname || "Unknown";
  const howOut = newFow?.howout || "";

  return {
    type: "WICKET",
    batterName,
    howOut,
    score: curr.score,
    wickets: curr.wickets,
    overs: curr.overs,
  };
}

export function extractPlayersFromScorecard(innings) {
  if (!innings) return {};

  const notOut = innings.batsman.filter((b) => !b.outdec || b.outdec === "");

  if (notOut.length < 2) {
    return {
      striker: "",
      nonStriker: "",
      strikerRuns: "",
      strikerBallsPlayed: "",
      nonStrikerRuns: "",
      nonStrikerBallsPlayed: "",
      bowler: "",
    };
  }

  notOut.sort((a, b) => b.balls - a.balls);

  const strikerObj = notOut[0];
  const nonStrikerObj = notOut[1];

  // 3) GET CURRENT BOWLER = last bowler in bowler list (most common)
  let bowlerObj = null;

  if (innings.bowler && innings.bowler.length > 0) {
    // Cricbuzz lists current over bowler last (sometimes at index 0)
    bowlerObj =
      innings.bowler.find((b) => Number(b.balls) % 6 !== 0) ||
      innings.bowler[innings.bowler.length - 1];
  }

  return {
    striker: strikerObj?.name || "",
    nonStriker: nonStrikerObj?.name || "",
    strikerRuns: strikerObj?.runs || "",
    strikerBallsPlayed: strikerObj?.balls || "",
    nonStrikerRuns: nonStrikerObj?.runs || "",
    nonStrikerBallsPlayed: nonStrikerObj?.balls || "",
    bowler: bowlerObj?.name || "",
  };
}

export function getActiveBattersFromInnings(innings) {
  if (!innings?.batsman) return { bat1: "", bat2: "" };

  const active = innings.batsman.filter((b) => b.outdec === "batting");

  // Ensure exactly 2 batters (or fill blanks)
  const bat1 = active[0]?.name || "";
  const bat2 = active[1]?.name || "";

  return { bat1, bat2 };
}

export function detectBatsmanMilestone(prev, curr) {
  if (!prev?.batsman || !curr?.batsman) return null;

  for (const bCurr of curr.batsman) {
    const bPrev = prev.batsman.find((p) => p.id === bCurr.id);
    if (!bPrev) continue;

    const prevRuns = Number(bPrev.runs || 0);
    const currRuns = Number(bCurr.runs || 0);

    const milestone =
      Math.floor(currRuns / BATSMAN_MILESTONE_RUNS) * BATSMAN_MILESTONE_RUNS;

    // milestone must be >= 50 and must be newly crossed
    if (milestone >= BATSMAN_MILESTONE_RUNS && prevRuns < milestone) {
      return {
        type: "BATSMAN_MILESTONE",
        milestone,
        batterName: bCurr.name,
        runs: currRuns,
        balls: bCurr.balls,
      };
    }
  }

  return null;
}
export function detectBowlerMilestone(prev, curr) {
  if (!prev || !curr) return null;

  const prevMap = {};
  prev.bowler?.forEach((b) => (prevMap[b.id] = b.wickets));

  for (const bow of curr.bowler || []) {
    const before = prevMap[bow.id] ?? bow.wickets;

    if (
      bow.wickets === BOWLER_MILESTONE_WICKETS &&
      before < BOWLER_MILESTONE_WICKETS
    ) {
      return {
        type: "BOWLER_MILESTONE",
        bowlerId: bow.id,
        bowlerName: bow.name,
        wickets: bow.wickets,
        overs: bow.overs,
        runs: bow.runs,
      };
    }
  }

  return null;
}

export function getPartnershipContributions(currInnings) {
  const p = currInnings?.partnership?.partnership?.[0];
  if (!p) return null;

  return {
    totalRuns: p.totalruns,
    totalBalls: p.totalballs,
    bat1: {
      name: p.bat1name,
      runs: p.bat1runs,
      balls: p.bat1balls,
    },
    bat2: {
      name: p.bat2name,
      runs: p.bat2runs,
      balls: p.bat2balls,
    },
  };
}
