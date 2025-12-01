// inningsDetector.js

import {
  BATSMAN_MILESTONE_RUNS,
  BOWLER_MILESTONE_WICKETS,
  PARTNERSHIP_MILESTONE_RUNS,
  TEAM_MILESTONE_RUNS,
} from "../utils/constants.js";
import { buildMatchResultTemplate } from "./templates.js";
import { buildHashtags } from "./tweet-validators/tweetValidators.js";

function ballNbrToOverDecimal(ballNbr) {
  const over = Math.floor(ballNbr / 6); // 294 → 49
  const ball = ballNbr % 6 || 6; // 294 % 6 = 0 → 6
  return `${over - (ball === 6 ? 1 : 0)}.${ball}`;
}
export function detectFour(prev, curr) {
  // console.log("detectFour prev::", prev);
  // console.log("detectFour curr::", curr);
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
        ballNbr: curr.ballnbr,
        currentOver: ballNbrToOverDecimal(curr.ballnbr),
      };
    }
  }
  return null;
}

export function detectSix(prev, curr) {
  // console.log("detectSix prev::", prev);
  // console.log("detectSix curr::", curr);
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
  // console.log("detectWicket prev::", prev);
  // console.log("detectWicket curr::", curr);
  if (!prev || !curr) return null;
  if (!curr.fow || !curr.fow.fow) return null;

  const prevFowList = prev.fow?.fow || [];
  const currFowList = curr.fow.fow;

  console.log("detectWicket1:::", currFowList.length);
  console.log("detectWicket2:::", prevFowList.length);

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
        runs: currRuns,
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

// cricbuzz/handlers/specialEvents.js

// import { buildMatchResultTemplate } from "../templates.js";
// import { buildHashtags } from "../../tweet-validators/tweetValidators.js";

export function handleTossTweet(match, event) {
  const tossWinner = event?.tossWinner;
  const tossDecision = event?.tossDecision;

  // Invalid data → skip
  if (
    !tossWinner ||
    tossWinner.trim() === "" ||
    !tossDecision ||
    tossDecision.trim() === ""
  ) {
    return "SKIP";
  }

  const tossText =
    event.tossText || `${tossWinner} won the toss and chose to ${tossDecision}`;

  const hashtags = buildHashtags(
    match,
    match.team1Short,
    match.team2Short,
    event.bat1 || event.partnership?.bat1?.name,
    event.bat2 || event.partnership?.bat2?.name
  );

  return `🪙 Toss Update

${tossText}

${hashtags}`;
}

export function handleMatchResultTweet(match, event) {
  const output = buildMatchResultTemplate(match, event.resultText);

  if (!output || typeof output !== "string") {
    return `🏆 Match Result\n\n${event.resultText}\n\n#${match.team1Short}vs${match.team2Short}`;
  }

  return output;
}
