// events.js

// Persistent state between polls
let last = {
  inningsKey: null,
  runs: 0,
  wickets: 0,
  overs: 0,
  ballnbr: 0,
  batsmanMap: {},
  partnershipRuns: 0,
  session: null,
  matchComplete: false,
  playerMilestones: {},
  partnershipMultiple: 0,
};

// ------------ Helpers ----------------

function buildBatsmanMap(innings) {
  const map = {};
  for (const b of innings.batsman || []) {
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

function getActiveBatsmen(innings) {
  return (innings.batsman || []).filter((b) => b.outdec === "batting");
}

function getCurrentBowler(innings) {
  const arr = innings.bowler || [];
  if (!arr.length) return null;
  return arr[arr.length - 1].name;
}

function getCurrentPartnership(innings) {
  const plist = innings.partnership?.partnership || [];
  if (!plist.length) return null;
  return plist[plist.length - 1];
}

function extractBowlerFromOutdec(outdec) {
  if (!outdec) return null;
  const m = outdec.match(/b\s(.+)$/);
  return m ? m[1].trim() : null;
}

function extractFielderFromOutdec(outdec) {
  if (!outdec) return null;

  let m = outdec.match(/c\s([^b]+)/);
  if (m) return m[1].trim();

  m = outdec.match(/run out\s*\(([^)]+)\)/i);
  if (m) return m[1].trim();

  return null;
}

// ------------ MAIN EVENT DETECTOR ----------------

export function detectEvents(data) {
  if (!data?.scorecard || !data.scorecard[0]) return null;

  const innings = data.scorecard[0];
  const inningsKey = innings.inningsid;
  const currRuns = innings.score;
  const currWkts = innings.wickets;
  const currOvers = innings.overs;
  const currBallnbr = innings.ballnbr ?? 0;
  const battingTeam = innings.batteamname;
  //   const bowlingTeam = innings.bowlteamname || "Unknown";
  const bowlingTeam = battingTeam === "South Africa" ? "India" : "South Africa";

  const currBatsmanMap = buildBatsmanMap(innings);
  const activeBatsmen = getActiveBatsmen(innings);
  const currentBowler = getCurrentBowler(innings);
  const currPartnership = getCurrentPartnership(innings);
  const currPartnershipRuns = currPartnership?.totalruns ?? 0;

  const prev = { ...last };
  const newLast = { ...last };

  // -------- Session (Lunch / Tea / Stumps) --------
  const statusLower = (data.status || "").toLowerCase();

  if (statusLower.includes("lunch") && prev.session !== "LUNCH") {
    newLast.session = "LUNCH";
  } else if (statusLower.includes("tea") && prev.session !== "TEA") {
    newLast.session = "TEA";
  } else if (statusLower.includes("stumps") && prev.session !== "STUMPS") {
    newLast.session = "STUMPS";
  }

  if (newLast.session !== prev.session) {
    saveSnapshot();
    return {
      type: "SESSION",
      session: newLast.session,
      battingTeam,
      bowlingTeam,
      runs: currRuns,
      wickets: currWkts,
      overs: currOvers,
    };
  }

  // -------- First poll --------
  if (!prev.inningsKey) {
    saveSnapshot();
    return null;
  }

  // -------- Innings change --------
  if (inningsKey !== prev.inningsKey) {
    newLast.playerMilestones = {};
    newLast.partnershipMultiple = 0;
    saveSnapshot();
    return {
      type: "INNINGS_CHANGE",
      battingTeam,
      bowlingTeam,
    };
  }

  // -------- Match complete --------
  if (data.ismatchcomplete && !prev.matchComplete) {
    newLast.matchComplete = true;
    saveSnapshot();

    let winner = null;
    const m = (data.status || "").match(/^([^,]+?)\s+won by/i);
    if (m) winner = m[1].trim();

    return {
      type: "MATCH_END",
      battingTeam,
      bowlingTeam,
      winner,
      status: data.status,
    };
  }

  // -------- WICKET detection --------
  let event = null;

  if (currWkts > prev.wickets) {
    let outBatsman = null;
    const prevMap = prev.batsmanMap;

    for (const b of innings.batsman || []) {
      const was = prevMap[b.id];
      const nowOut = b.outdec && b.outdec !== "batting";
      const wasBatting = !was || was.outdec === "batting" || !was.outdec;

      if (nowOut && wasBatting) {
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
        bowler: extractBowlerFromOutdec(outBatsman.outdec),
        fielder: extractFielderFromOutdec(outBatsman.outdec),
        runs: currRuns,
        wickets: currWkts,
        overs: currOvers,
      };
    }
  }

  // -------- SIX detection --------
  if (!event) {
    const prevMap = prev.batsmanMap;
    for (const b of activeBatsmen) {
      if (prevMap[b.id] && b.sixes > prevMap[b.id].sixes) {
        event = {
          type: "SIX",
          battingTeam,
          bowlingTeam,
          batsman: b.name,
          bowler: currentBowler,
          runs: currRuns,
          wickets: currWkts,
          overs: currOvers,
        };
        break;
      }
    }
  }

  // -------- FOUR detection --------
  if (!event) {
    const prevMap = prev.batsmanMap;
    for (const b of activeBatsmen) {
      if (prevMap[b.id] && b.fours > prevMap[b.id].fours) {
        event = {
          type: "FOUR",
          battingTeam,
          bowlingTeam,
          batsman: b.name,
          bowler: currentBowler,
          runs: currRuns,
          wickets: currWkts,
          overs: currOvers,
        };
        break;
      }
    }
  }

  // -------- SINGLE / DOUBLE detection --------
  if (!event) {
    const runDiff = currRuns - prev.runs;
    const wicketSame = currWkts === prev.wickets;

    if (wicketSame && runDiff === 1) {
      event = {
        type: "SINGLE",
        battingTeam,
        bowlingTeam,
        batsman: activeBatsmen?.[0]?.name || null,
        bowler: currentBowler,
        runs: currRuns,
        wickets: currWkts,
        overs: currOvers,
      };
    }

    if (wicketSame && runDiff === 2) {
      event = {
        type: "DOUBLE",
        battingTeam,
        bowlingTeam,
        batsman: activeBatsmen?.[0]?.name || null,
        bowler: currentBowler,
        runs: currRuns,
        wickets: currWkts,
        overs: currOvers,
      };
    }
  }

  // -------- milestones (50/100/150/…) --------
  if (!event) {
    const prevMap = prev.batsmanMap;
    const milestones = [50, 100, 150, 200, 250];

    for (const b of innings.batsman || []) {
      const prevB = prevMap[b.id] || { runs: 0 };
      const curr = b.runs;
      const prevRuns = prevB.runs;

      if (curr > prevRuns) {
        for (const m of milestones) {
          if (curr >= m && prevRuns < m) {
            const prevMultiple = newLast.playerMilestones[b.id] || 0;
            const thisMultiple = m / 50;

            if (thisMultiple > prevMultiple) {
              newLast.playerMilestones[b.id] = thisMultiple;
              event = {
                type: "MILESTONE",
                battingTeam,
                bowlingTeam,
                batsman: b.name,
                runs: curr,
                wickets: currWkts,
                overs: currOvers,
              };
              break;
            }
          }
        }
      }
      if (event) break;
    }
  }

  // -------- partnership milestones --------
  if (!event && currPartnershipRuns > 0) {
    const prevPRuns = prev.partnershipRuns;
    const prevMultiple = Math.floor(prevPRuns / 50);
    const currMultiple = Math.floor(currPartnershipRuns / 50);

    if (currMultiple > prevMultiple && currMultiple > 0) {
      newLast.partnershipMultiple = currMultiple;
      event = {
        type: "PARTNERSHIP",
        battingTeam,
        bowlingTeam,
        runs: currPartnershipRuns,
        bat1: currPartnership.bat1name,
        bat2: currPartnership.bat2name,
        wickets: currWkts,
        overs: currOvers,
      };
    }
  }

  // -------- Save state --------
  saveSnapshot();

  return event;

  // Internal helper
  function saveSnapshot() {
    newLast.inningsKey = inningsKey;
    newLast.runs = currRuns;
    newLast.wickets = currWkts;
    newLast.overs = currOvers;
    newLast.ballnbr = currBallnbr;
    newLast.batsmanMap = currBatsmanMap;
    newLast.partnershipRuns = currPartnershipRuns;
    last = newLast;
  }
}
