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

export function buildMatchContext({
  comm,
  currInnings,
  event,
  isMatchComplete,
  firstInnings,
}) {
  const mini = comm?.miniscore || {};
  const headers = comm?.matchheaders || {};

  // ============================
  // MATCH RESULT EVENT
  // ============================
  if (event?.type === "MATCH_RESULT") {
    const match = {
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
      status: event.resultText || headers?.status || "",
      venue: headers?.venue || "",
      isMatchComplete: true,
    };

    return {
      match,
      innings: null,
      event,
      players: {},
    };
  }

  // ============================
  // TOSS EVENT
  // ============================
  if (event?.type === "TOSS") {
    const match = {
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
      status: headers?.status || "",
      venue: headers?.venue || "",
      isMatchComplete: false,
    };

    return {
      match,
      innings: null,
      event,
      players: {},
    };
  }

  // ============================
  // NORMAL BALL EVENTS
  // ============================
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

  // On wicket, batsman name becomes striker
  if (event?.type === "WICKET" && event?.batterName) {
    players.striker = event.batterName;
  }

  const match = {
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
    status: headers?.status || "",
    venue: headers?.venue || "",
    isMatchComplete,
  };

  const innings = {
    inningsid: currInnings.inningsid,
    runs: currInnings.score,
    wickets: currInnings.wickets,
    overs: normalizeOvers(currInnings.overs),
    batteamname: currInnings.batteamname,
    batteamsname: currInnings.batteamsname,
    partnership: currInnings.partnership,
    batsman: currInnings.batsman,
    bowler: currInnings.bowler,
    partnership,
    targetInning: firstInnings,
  };

  const enrichedEvent = {
    ...event,
    bowlerName: mini?.bowlerstriker?.name || "",
  };

  return {
    match,
    innings,
    event: enrichedEvent,
    players,
  };
}
