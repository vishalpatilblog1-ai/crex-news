// cricbuzz/matchContext.js
import { shortTeamName } from "../utils/formatter.js";
import {
  getActiveBattersFromInnings,
  getPartnershipContributions,
} from "./inningsDetector.js";

// Copied from index.js exactly
function normalizeOvers(overs) {
  if (!overs) return overs;
  const p = overs.toString().split(".");
  const o = parseInt(p[0]);
  const b = parseInt(p[1] || "0");
  return b === 6 ? (o + 1).toFixed(1).replace(".0", "") : overs;
}

function buildBaseMatchObject(headers) {
  return {
    name:
      headers?.matchdescription ||
      `${headers?.team1?.teamname || ""} vs ${
        headers?.team2?.teamname || ""
      }`.trim(),

    team1: headers?.team1?.teamname || "",
    team2: headers?.team2?.teamname || "",

    team1Short:
      headers?.team1?.teamsname ||
      shortTeamName(headers?.team1?.teamname || ""),

    team2Short:
      headers?.team2?.teamsname ||
      shortTeamName(headers?.team2?.teamname || ""),

    format: headers?.matchformat || "",
    venue: headers?.venue || "",
  };
}
function buildMatchResultContext(headers, event) {
  const match = {
    ...buildBaseMatchObject(headers),
    status: event.resultText || headers?.status || "",
    isMatchComplete: true,
  };

  return {
    match,
    event,
    players: {},
  };
}
export function getTossWinnerShortName(comm) {
  const tossId = comm?.matchheaders?.tossresults?.tosswinnerid;
  if (!tossId) return "";

  const team1 = comm?.matchheaders?.team1;
  const team2 = comm?.matchheaders?.team2;

  if (team1?.teamid === tossId) return team1?.teamsname || "";
  if (team2?.teamid === tossId) return team2?.teamsname || "";

  return "";
}

function buildTossContext(headers, comm, event) {
  const match = {
    ...buildBaseMatchObject(headers),
    status: headers?.status || "",
    isMatchComplete: false,
  };
  const tossWinnerShortName = getTossWinnerShortName(comm);

  const enrichedEvent = {
    ...event,
    tossWinner: comm?.matchheaders?.tossresults?.tosswinnername || "",
    tossWinnerShortName,
    tossDecision: comm?.matchheaders?.tossresults?.decision,
  };

  return {
    match,
    event: enrichedEvent,
    players: {},
  };
}
export function buildMatchContext({
  comm,
  currInnings,
  event,
  isMatchComplete,
  firstInnings,
}) {
  const mini = comm?.miniscore || {};
  const headers = comm?.matchheaders || {};
  if (event?.type === "MATCH_RESULT") {
    return buildMatchResultContext(headers, event);
  }

  if (event?.type === "TOSS") {
    return buildTossContext(headers, comm, event);
  }

  const active = getActiveBattersFromInnings(currInnings);
  const partnership = getPartnershipContributions(currInnings);

  const players = {
    striker: active.bat1,
    nonStriker: active.bat2,
    strikerRuns: "",
    strikerBallsPlayed: "",
    nonStrikerRuns: "",
    nonStrikerBallsPlayed: "",
    bowler: mini?.bowlerstriker?.name || "",
  };

  if (event?.type === "WICKET" && event?.batterName) {
    players.striker = event.batterName;
  }

  const match = {
    ...buildBaseMatchObject(headers),
    status: headers?.status || "",
    isMatchComplete,
  };

  const isLastBall = (() => {
    const ballNbr = currInnings?.ballnbr;
    if (ballNbr == null) return false;
    return ballNbr % 6 === 0;
  })();

  let correctBowlerName;

  if (isLastBall) {
    correctBowlerName =
      mini?.bowlernonstriker?.name || mini?.bowlerstriker?.name || "";
  } else {
    correctBowlerName = mini?.bowlerstriker?.name || "";
  }
  const { overs, ...rest } = currInnings;
  console.log("current ball:::", overs);
  console.log("bowlerstriker ::", mini?.bowlerstriker?.name);
  console.log("bowlernonstriker ::", mini?.bowlernonstriker?.name);
  console.log("correctBowlerName::", correctBowlerName);

  const enrichedEvent = {
    ...event,
    // bowlerName: correctBowlerName,
    bowlerName: mini?.bowlerstriker?.name || "",
    inningsid: currInnings.inningsid,
    runs: currInnings.score,
    wickets: currInnings.wickets,
    overs: normalizeOvers(currInnings.overs),
    batteamname: currInnings.batteamname,
    batteamsname: currInnings.batteamsname,
    batsman: currInnings.batsman,
    bowler: currInnings.bowler,
    partnership: partnership || currInnings.partnership,
    targetInning: firstInnings,
  };

  return {
    match,
    event: enrichedEvent,
    players,
  };
}
