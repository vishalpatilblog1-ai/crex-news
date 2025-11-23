// events.js — FINAL PRODUCTION VERSION (with bowlingTeam in every event)

// Keeps state between polls

let TEAM1 = null;
let TEAM2 = null;

export function setTeams(t1, t2) {
  TEAM1 = t1;
  TEAM2 = t2;
}

let last = {
  inningsKey: null,
  runs: 0,
  wickets: 0,
  overs: 0,
  ballnbr: 0,
  batsmanMap: {},
  partnershipRuns: 0,
  session: null,
  tossTweeted: false,
  matchComplete: false,
  playerMilestones: {},
  partnershipMultiple: 0,
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

  // Find bowler with “overs > 0” or “maidens >= 0”
  // Cricbuzz marks current bowler with ballsbowled > 0 OR economy showing
  const active = arr.find((b) => b.overs && b.overs !== "0.0");

  return active ? active.name : arr[arr.length - 1].name;
}

function getCurrentPartnership(inn) {
  const ps = inn.partnership?.partnership || [];
  if (!ps.length) return null;
  return ps[ps.length - 1];
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

function parseToss(status) {
  if (!status) return null;
  const m = status.match(/-([^–-]+)opt to (bat|bowl|field)/i);
  if (!m) return null;
  return {
    wonBy: m[1].trim(),
    decision: m[2].toLowerCase() === "bat" ? "BAT" : "FIELD",
  };
}

export function detectEvents(data) {
  if (!data?.scorecard || !data.scorecard[0]) return null;

  const inn = data.scorecard[0];
  const inningsKey = inn.inningsid;

  const currRuns = inn.score;
  const currWkts = inn.wickets;
  const currOvers = inn.overs;
  const currBall = inn.ballnbr ?? 0;

  const battingTeam = inn.batteamname;
  //   const bowlingTeam = inn.bowlteamname || "Unknown";
  const bowlingTeam =
    inn.bowlteamname || (battingTeam === TEAM1 ? TEAM2 : TEAM1);
  const currMap = buildBatsmanMap(inn);
  const active = getActiveBatsmen(inn);
  const bowler = getCurrentBowler(inn);

  const currPartnership = getCurrentPartnership(inn);
  const currPRuns = currPartnership?.totalruns ?? 0;

  const prev = { ...last };
  const newLast = { ...last };

  // ------------------------------------------------------------------
  // SESSION — Lunch / Tea / Stumps / Drinks
  // ------------------------------------------------------------------
  const st = (data.status || "").toLowerCase();

  const sessionTypes = [
    { key: "lunch", type: "LUNCH" },
    { key: "tea", type: "TEA" },
    { key: "stumps", type: "STUMPS" },
    { key: "drinks", type: "DRINKS" },
  ];

  for (const s of sessionTypes) {
    if (st.includes(s.key) && newLast.session !== s.type) {
      newLast.session = s.type;

      Object.assign(newLast, {
        inningsKey,
        runs: currRuns,
        wickets: currWkts,
        overs: currOvers,
        ballnbr: currBall,
        batsmanMap: currMap,
        partnershipRuns: currPRuns,
      });

      last = newLast;
      return {
        type: "SESSION",
        session: s.type,
        battingTeam,
        bowlingTeam,
        runs: currRuns,
        wickets: currWkts,
        overs: currOvers,
      };
    }
  }

  // ------------------------------------------------------------------
  // First init
  // ------------------------------------------------------------------
  if (!prev.inningsKey) {
    Object.assign(newLast, {
      inningsKey,
      runs: currRuns,
      wickets: currWkts,
      overs: currOvers,
      ballnbr: currBall,
      batsmanMap: currMap,
      partnershipRuns: currPRuns,
    });
    last = newLast;
    return null;
  }

  // ------------------------------------------------------------------
  // INNINGS CHANGE
  // ------------------------------------------------------------------
  if (inningsKey !== prev.inningsKey) {
    Object.assign(newLast, {
      inningsKey,
      runs: currRuns,
      wickets: currWkts,
      overs: currOvers,
      ballnbr: currBall,
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

  // ------------------------------------------------------------------
  // MATCH END
  // ------------------------------------------------------------------
  if (data.ismatchcomplete && !newLast.matchComplete) {
    newLast.matchComplete = true;

    Object.assign(newLast, {
      inningsKey,
      runs: currRuns,
      wickets: currWkts,
      overs: currOvers,
      ballnbr: currBall,
      batsmanMap: currMap,
      partnershipRuns: currPRuns,
    });

    let winner = null;
    const m = (data.status || "").match(/^([^,]+?)\s+won by/i);
    if (m) winner = m[1].trim();

    last = newLast;

    return {
      type: "MATCH_END",
      winner,
      status: data.status,
      battingTeam,
      bowlingTeam,
    };
  }

  // ------------------------------------------------------------------
  // BALL EVENTS
  // ------------------------------------------------------------------
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
        bowler: extractBowler(outBatsman.outdec),
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

  // WIDE / NO BALL
  if (!event) {
    const diffRuns = currRuns - prev.runs;

    // Wide: +1 run + ballnbr stays same
    if (currBall === prev.ballnbr && diffRuns === 1) {
      event = {
        type: "WIDE",
        battingTeam,
        bowlingTeam,
        bowler,
        runs: currRuns,
        wickets: currWkts,
        overs: currOvers,
      };
    }

    // No-ball: +1 run + ballnbr stays same
    if (!event && currBall === prev.ballnbr && diffRuns === 1) {
      event = {
        type: "NO_BALL",
        battingTeam,
        bowlingTeam,
        bowler,
        runs: currRuns,
        wickets: currWkts,
        overs: currOvers,
      };
    }
  }

  // SINGLE / DOUBLE
  if (!event) {
    const diff = currRuns - prev.runs;
    if (currWkts === prev.wickets) {
      if (diff === 1) {
        event = {
          type: "SINGLE",
          battingTeam,
          bowlingTeam,
          batsman: active[0]?.name || null,
          bowler,
          runs: currRuns,
          wickets: currWkts,
          overs: currOvers,
        };
      }

      if (diff === 2) {
        event = {
          type: "DOUBLE",
          battingTeam,
          bowlingTeam,
          batsman: active[0]?.name || null,
          bowler,
          runs: currRuns,
          wickets: currWkts,
          overs: currOvers,
        };
      }
    }
  }

  // ------------------------------------------------------------------
  // MILESTONES (50/100/150…)
  // ------------------------------------------------------------------
  if (!event) {
    const milestones = [50, 100, 150, 200, 250];

    for (const b of inn.batsman || []) {
      const pb = prevMap[b.id] || { runs: 0 };
      if (b.runs > pb.runs) {
        for (const m of milestones) {
          if (b.runs >= m && pb.runs < m) {
            const prevM = newLast.playerMilestones[b.id] || 0;
            const currM = m / 50;

            if (currM > prevM) {
              newLast.playerMilestones[b.id] = currM;
              event = {
                type: "MILESTONE",
                battingTeam,
                bowlingTeam,
                batsman: b.name,
                runs: b.runs,
                wickets: currWkts,
                overs: currOvers,
              };
            }
          }
        }
      }
      if (event) break;
    }
  }

  // ------------------------------------------------------------------
  // PARTNERSHIP milestones
  // ------------------------------------------------------------------
  if (!event && currPRuns > 0) {
    const prevMul = Math.floor(prev.partnershipRuns / 50);
    const currMul = Math.floor(currPRuns / 50);

    if (currMul > prevMul && currMul > 0 && currPartnership) {
      newLast.partnershipMultiple = currMul;
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

  // ------------------------------------------------------------------
  // Update snapshot ALWAYS
  // ------------------------------------------------------------------
  Object.assign(newLast, {
    inningsKey,
    runs: currRuns,
    wickets: currWkts,
    overs: currOvers,
    ballnbr: currBall,
    batsmanMap: currMap,
    partnershipRuns: currPRuns,
  });

  last = newLast;
  return event;
}
