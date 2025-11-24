// cricbuzz/events.js
// FINAL VERSION: pure scorecard, no commentary, super-over aware

// Keeps team names for fallback
let TEAM1 = null;
let TEAM2 = null;

export function setTeams(t1, t2) {
  TEAM1 = t1;
  TEAM2 = t2;
}

export function getMatchFormat(seotitle = "") {
  const t = seotitle.toLowerCase();
  if (t.includes("t20")) return "T20I";
  if (t.includes("odi")) return "ODI";
  if (t.includes("test")) return "Test";
  return "Match";
}

// Internal snapshot of last state
let last = {
  inningsKey: null,
  ballKey: null, // unique per innings+ball
  runs: 0,
  wickets: 0,
  overs: 0,
  batsmanMap: {},
  partnershipRuns: 0,
  playerMilestones: {}, // not used yet but kept for future
  partnershipMultiple: 0, // 0,1,2... for 50,100,150 stands
  matchComplete: false,
};

function buildBatsmanMap(inn) {
  const map = {};
  for (const b of inn.batsman || []) {
    map[b.id] = {
      runs: b.runs,
      fours: b.fours,
      sixes: b.sixes,
      outdec: b.outdec,
      name: b.name,
    };
  }
  return map;
}

function getActiveBatsmen(inn) {
  return (inn.batsman || []).filter((b) => b.outdec === "batting");
}

function getCurrentBowler(inn) {
  const arr = inn.bowler || [];
  if (!arr.length) return null;

  // Cricbuzz usually has current bowler with overs > 0
  const active = arr.find((b) => b.overs && b.overs !== "0.0");
  return active ? active.name : arr[arr.length - 1].name;
}

function getCurrentPartnership(inn) {
  const ps = inn.partnership?.partnership || [];
  return ps.length ? ps[ps.length - 1] : null;
}

function extractBowler(outdec) {
  if (!outdec) return null;
  const m = outdec.match(/b\s(.+)$/);
  return m ? m[1].trim() : null;
}

function extractFielder(outdec) {
  if (!outdec) return null;

  let m = outdec.match(/c\s([^b]+)/);
  if (m) return m[1].trim();

  m = outdec.match(/run out\s*\(([^)]+)\)/i);
  if (m) return m[1].trim();

  return null;
}

// We accept commentary param but IGNORE it (pure scorecard mode)
export function detectEvents(data, _commentary) {
  if (!data?.scorecard?.length) return null;

  const inn = data.scorecard[data.scorecard.length - 1];

  const inningsKey = inn.inningsid;
  const currRuns = inn.score;
  const currWkts = inn.wickets;
  const currOvers = inn.overs;
  const currBall = inn.ballnbr ?? 0;

  const ballKey = `${inningsKey}_${currBall}`;

  const battingTeam = inn.batteamname;
  const bowlingTeam =
    inn.bowlteamname || (battingTeam === TEAM1 ? TEAM2 : TEAM1);

  const currMap = buildBatsmanMap(inn);
  const active = getActiveBatsmen(inn);
  const bowler = getCurrentBowler(inn);
  const currPartnership = getCurrentPartnership(inn);
  const currPRuns = currPartnership?.totalruns ?? 0;

  const prev = { ...last };
  const newLast = { ...last };

  const statusLower = (data.status || "").toLowerCase();
  const isSuperOver = statusLower.includes("super over");

  // ---------------------------------------------------
  // 0) First poll → just prime snapshot, no event
  // ---------------------------------------------------
  if (!prev.inningsKey) {
    Object.assign(newLast, {
      inningsKey,
      ballKey,
      runs: currRuns,
      wickets: currWkts,
      overs: currOvers,
      batsmanMap: currMap,
      partnershipRuns: currPRuns,
    });
    last = newLast;
    return null;
  }

  // ---------------------------------------------------
  // 1) Ignore duplicate polls of same ball
  // ---------------------------------------------------
  if (
    ballKey === prev.ballKey &&
    currRuns === prev.runs &&
    currWkts === prev.wickets
  ) {
    // Nothing changed since last poll
    return null;
  }

  // ---------------------------------------------------
  // 2) New innings (includes super over start)
  // ---------------------------------------------------
  if (inningsKey !== prev.inningsKey) {
    Object.assign(newLast, {
      inningsKey,
      ballKey,
      runs: currRuns,
      wickets: currWkts,
      overs: currOvers,
      batsmanMap: currMap,
      partnershipRuns: currPRuns,
      playerMilestones: {},
      partnershipMultiple: 0,
    });

    last = newLast;

    return {
      type: "INNINGS_CHANGE",
      battingTeam,
      bowlingTeam,
    };
  }

  // ---------------------------------------------------
  // 3) Match end
  //    Important: if status says "super over in progress"
  //    we MUST NOT treat it as final result.
  // ---------------------------------------------------
  if (data.ismatchcomplete && !prev.matchComplete && !isSuperOver) {
    newLast.matchComplete = true;
    newLast.ballKey = ballKey;
    last = newLast;

    let winner = null;
    const m = (data.status || "").match(/^([^,]+?)\s+won by/i);
    if (m) winner = m[1].trim();

    return {
      type: "MATCH_END",
      winner,
      status: data.status,
      battingTeam,
      bowlingTeam,
    };
  }

  // ---------------------------------------------------
  // 4) Ball-level events
  // ---------------------------------------------------
  let event = null;

  // WICKET
  if (currWkts > prev.wickets) {
    let outBatsman = null;

    for (const b of inn.batsman || []) {
      const was = prev.batsmanMap[b.id];
      const nowOut = b.outdec && b.outdec !== "batting";
      const wasBat = !was || was.outdec === "batting" || !was.outdec;

      if (nowOut && wasBat) {
        outBatsman = b;
        break;
      }
    }

    if (outBatsman) {
      event = {
        type: "WICKET",
        battingTeam,
        bowlingTeam,
        batsman: outBatsman.name,
        howout: outBatsman.outdec,
        bowler: extractBowler(outBatsman.outdec) || bowler,
        fielder: extractFielder(outBatsman.outdec),
        runs: currRuns,
        wickets: currWkts,
        overs: currOvers,
      };
    }
  }

  const prevMap = prev.batsmanMap || {};

  // SIX
  if (!event) {
    for (const b of active) {
      const pb = prevMap[b.id];
      if (pb && b.sixes > pb.sixes) {
        event = {
          type: "SIX",
          battingTeam,
          bowlingTeam,
          batsman: b.name,
          bowler,
          runs: currRuns,
          wickets: currWkts,
          overs: currOvers,
        };
        break;
      }
    }
  }

  // FOUR
  if (!event) {
    for (const b of active) {
      const pb = prevMap[b.id];
      if (pb && b.fours > pb.fours) {
        event = {
          type: "FOUR",
          battingTeam,
          bowlingTeam,
          batsman: b.name,
          bowler,
          runs: currRuns,
          wickets: currWkts,
          overs: currOvers,
        };
        break;
      }
    }
  }

  // ---------------------------------------------------
  // 5) Milestones (50/100/150…)
  // ---------------------------------------------------
  if (!event) {
    const milestones = [50, 100, 150, 200, 250];

    for (const b of inn.batsman || []) {
      const pb = prevMap[b.id] || { runs: 0 };

      if (b.runs > pb.runs) {
        for (const m of milestones) {
          if (b.runs >= m && pb.runs < m) {
            event = {
              type: "MILESTONE",
              battingTeam,
              bowlingTeam,
              batsman: b.name,
              runs: b.runs,
              wickets: currWkts,
              overs: currOvers,
            };
            break;
          }
        }
      }
      if (event) break;
    }
  }

  // ---------------------------------------------------
  // 6) Partnership milestones (50, 100, 150…)
  // ---------------------------------------------------
  if (!event && currPRuns > 0) {
    const prevMul = Math.floor(prev.partnershipRuns / 50);
    const currMul = Math.floor(currPRuns / 50);

    if (currMul > prevMul && currMul > 0 && currPartnership) {
      event = {
        type: "PARTNERSHIP",
        battingTeam,
        bowlingTeam,
        runs: currPRuns,
        bat1: currPartnership.bat1name,
        bat2: currPartnership.bat2name,
        wickets: currWkts,
        overs: currOvers,
      };
    }
  }

  // ---------------------------------------------------
  // 7) Update snapshot ALWAYS
  // ---------------------------------------------------
  Object.assign(newLast, {
    inningsKey,
    ballKey,
    runs: currRuns,
    wickets: currWkts,
    overs: currOvers,
    batsmanMap: currMap,
    partnershipRuns: currPRuns,
  });

  last = newLast;
  return event;
}
