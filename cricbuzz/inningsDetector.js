// inningsDetector.js

import {
  BATSMAN_MILESTONE_RUNS,
  BOWLER_MILESTONE_WICKETS,
  PARTNERSHIP_MILESTONE_RUNS,
  TEAM_MILESTONE_RUNS,
} from "../utils/constants.js";

function ballNbrToOverDecimal(ballNbr) {
  const over = Math.floor(ballNbr / 6);
  const ball = ballNbr % 6 || 6;
  return `${over - (ball === 6 ? 1 : 0)}.${ball}`;
}

function getCurrentBowler(prev, curr) {
  if (!prev || !curr?.bowler) return null;

  const prevMap = {};
  prev.bowler?.forEach((b) => {
    prevMap[b.id] = Number(b.balls) || 0;
  });

  const increased = curr.bowler.find((bow) => {
    const prevBalls = prevMap[bow.id] ?? 0;
    return Number(bow.balls) > prevBalls;
  });

  if (increased) return increased;
  const midOver = curr.bowler.find((b) => Number(b.balls) % 6 !== 0);
  if (midOver) return midOver;
  return curr.bowler[0];
}

export function detectDefault(prev, curr) {
  if (!prev || !curr) return null;

  const bowler = getCurrentBowler(prev, curr);

  return {
    type: "BALL_UPDATE",

    ballNbr: curr.ballnbr,
    currentOver: ballNbrToOverDecimal(curr.ballnbr),
    currentOverString: curr.overs ?? "",
    bowlerId: bowler?.id || "",
    bowlerName: bowler?.name || "",
    bowlerOvers: bowler?.overs || "",
    bowlerRuns: bowler?.runs || "",
    bowlerWickets: bowler?.wickets || "",
    bowlerBalls: bowler?.balls || "",
    bowlerEconomy: bowler?.economy || "",
    rawBowlerObject: bowler,
  };
}

export function detectFour(prev, curr) {
  if (!prev || !curr) return null;

  const prevMap = {};
  prev.batsman?.forEach((b) => (prevMap[b.id] = b.fours));
  const bowler = getCurrentBowler(prev, curr);

  for (const bat of curr.batsman || []) {
    const before = prevMap[bat.id] ?? bat.fours;
    if (bat.fours > before) {
      return {
        type: "FOUR",
        batterId: bat.id,
        batterName: bat.name,
        bowlerName: bowler?.name || "",
        runs: bat.runs,
        balls: bat.balls,
        ballNbr: curr.ballnbr,
        currentOver: ballNbrToOverDecimal(curr.ballnbr),
      };
    }
  }
  return null;
}

export function detectSix(prev, curr) {
  if (!prev || !curr) return null;

  const prevMap = {};
  prev.batsman?.forEach((b) => (prevMap[b.id] = b.sixes));
  const bowler = getCurrentBowler(prev, curr);

  for (const bat of curr.batsman || []) {
    const before = prevMap[bat.id] ?? bat.sixes;

    if (bat.sixes > before) {
      return {
        type: "SIX",
        batterId: bat.id,
        batterName: bat.name,
        bowlerName: bowler?.name || "",
        runs: bat.runs,
        balls: bat.balls,
        currentOver: ballNbrToOverDecimal(curr.ballnbr),
        ballNbr: curr.ballnbr,
      };
    }
  }
  return null;
}

export function detectTeamMilestone(prev, curr) {
  if (!prev || !curr) return null;

  const prevRuns = prev.score ?? prev.runs ?? null;
  const currRuns = curr.score ?? curr.runs ?? null;

  const prevBalls = prev.balls ?? null;
  const currBalls = curr.balls ?? null;

  if (prevRuns == null || currRuns == null) return null;

  const isMilestone =
    currRuns > prevRuns && currRuns % TEAM_MILESTONE_RUNS === 0;

  if (!isMilestone) return null;

  return {
    type: "TEAM_MILESTONE",
    runs: currRuns,
    balls: currBalls || curr.ballnbr,
    currentOver: ballNbrToOverDecimal(curr.ballnbr),
    ballNbr: curr.ballnbr,
  };
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
      currentOver: ballNbrToOverDecimal(curr.ballnbr),
      ballNbr: curr.ballnbr,
    };
  }

  if (currActive.totalruns > prevActive.totalruns) {
    const runs = currActive.totalruns;

    if (runs % PARTNERSHIP_MILESTONE_RUNS === 0) {
      return {
        type: "PARTNERSHIP_MILESTONE",
        bat1: currActive.bat1name,
        bat2: currActive.bat2name,
        runs,
        balls: currActive.totalballs,
        currentOver: ballNbrToOverDecimal(curr.ballnbr),
        ballNbr: curr.ballnbr,
      };
    }

    return {
      type: "PARTNERSHIP_UPDATED",
      bat1: currActive.bat1name,
      bat2: currActive.bat2name,
      runs,
      balls: currActive.totalballs,
      currentOver: ballNbrToOverDecimal(curr.ballnbr),
      ballNbr: curr.ballnbr,
    };
  }

  return null;
}

export function detectWicket(prev, curr) {
  if (!prev || !curr) return null;
  if (!curr.fow || !curr.fow.fow) return null;

  const prevFowList = prev.fow?.fow || [];
  const currFowList = curr.fow.fow;

  const bowler = getCurrentBowler(prev, curr);

  if (currFowList.length === prevFowList.length) return null;

  const newFow = currFowList[currFowList.length - 1];

  const batterName = newFow?.batsmanname || "Unknown";
  const howOut = newFow?.howout || "";

  return {
    type: "WICKET",
    batterName,
    bowlerName: bowler?.name || "",
    howOut,
    score: curr.score,
    wickets: curr.wickets,
    overs: curr.overs,
    currentOver: ballNbrToOverDecimal(curr.ballnbr),
    ballNbr: curr.ballnbr,
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
      currentRunningOver: innings.overs,
    };
  }

  notOut.sort((a, b) => b.balls - a.balls);

  const strikerObj = notOut[0];
  const nonStrikerObj = notOut[1];

  let bowlerObj = null;

  if (innings.bowler && innings.bowler.length > 0) {
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
    currentRunningOver: innings.overs,
  };
}

export function getActiveBattersFromInnings(innings) {
  if (!innings?.batsman) return { bat1: "", bat2: "" };

  const active = innings.batsman.filter((b) => b.outdec === "batting");

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

    if (milestone >= BATSMAN_MILESTONE_RUNS && prevRuns < milestone) {
      return {
        type: "BATSMAN_MILESTONE",
        milestone,
        batterName: bCurr.name,
        // runs: currRuns,
        runs: bCurr.runs,
        balls: bCurr.balls,
        currentOver: ballNbrToOverDecimal(curr.ballnbr),
        ballNbr: curr.ballnbr,
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
        currentRunningOver: curr.overs,
        ballNbr: curr.ballnbr,
      };
    }
  }

  return null;
}

export function getPartnershipContributions(currInnings) {
  const list = currInnings?.partnership?.partnership;
  if (!Array.isArray(list) || list.length === 0) return null;

  const p = list[list.length - 1];

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
    currentRunningOver: currInnings.overs,
  };
}

export function detectMaidenOver(prev, curr) {
  if (!prev || !curr) return null;

  const prevBowler = curr.bowler?.find((b) => {
    const p = prev.bowler?.find((x) => x.id === b.id);
    return p != null;
  });

  if (!prevBowler) return null;

  const currBowler = curr.bowler.find((b) => b.id === prevBowler.id);
  if (!currBowler) return null;

  const prevOvers = prevBowler.overs;
  const currOvers = currBowler.overs;

  const toBalls = (o) => {
    const [ov, balls] = o.toString().split(".");
    return Number(ov) * 6 + Number(balls || 0);
  };

  const prevBalls = toBalls(prevOvers);
  const currBalls = toBalls(currOvers);

  const ballsDelta = currBalls - prevBalls;
  const runsDelta = (currBowler.runs || 0) - (prevBowler.runs || 0);

  if (ballsDelta === 6 && runsDelta === 0) {
    return {
      type: "MAIDEN_OVER",
      bowlerName: currBowler.name,
      overs: currOvers,
    };
  }

  return null;
}
