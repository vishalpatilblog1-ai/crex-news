// events.js

// Keeps state between polls
let last = {
  inningsKey: null,
  runs: 0,
  wickets: 0,
  overs: 0,
  ballnbr: 0,
  batsmanMap: {}, // { [id]: { runs, fours, sixes, outdec } }
  partnershipRuns: 0,
  session: null,
  tossTweeted: false,
  matchComplete: false,
  playerMilestones: {}, // { [id]: multipleOf50 }  e.g. 1 => 50, 2 => 100
  partnershipMultiple: 0, // last partnership multiple of 50 tweeted
};

// Small helpers
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
  // those currently "batting"
  return (innings.batsman || []).filter((b) => b.outdec === "batting");
}

function getCurrentBowler(innings) {
  const arr = innings.bowler || [];
  if (!arr.length) return null;
  return arr[arr.length - 1].name; // last bowler = current
}

function getCurrentPartnership(innings) {
  const plist = innings.partnership?.partnership || [];
  if (!plist.length) return null;
  return plist[plist.length - 1];
}

function extractBowlerFromOutdec(outdec) {
  // e.g. "c Pant b Kuldeep Yadav" → "Kuldeep Yadav"
  //      "b Bumrah" → "Bumrah"
  if (!outdec) return null;
  const m = outdec.match(/b\s(.+)$/);
  return m ? m[1].trim() : null;
}

function extractFielderFromOutdec(outdec) {
  // e.g. "c Pant b Kuldeep Yadav" → "Pant"
  //      "run out (Jadeja)" → "Jadeja"
  if (!outdec) return null;
  let m = outdec.match(/c\s([^b]+)/);
  if (m) return m[1].trim();

  m = outdec.match(/run out\s*\(([^)]+)\)/i);
  if (m) return m[1].trim();

  return null;
}

function parseTossFromStatus(status) {
  // Example: "Day 1: Stumps - South Africa opt to bat"
  if (!status) return null;
  const m = status.match(/-([^–-]+)opt to (bat|bowl|field)/i);
  if (!m) return null;
  const team = m[1].trim();
  const decisionWord = m[2].toLowerCase();
  const decision = decisionWord === "bat" ? "BAT" : "FIELD";
  return { wonBy: team, decision };
}

export function detectEvents(data) {
  if (!data?.scorecard || !data.scorecard[0]) return null;

  const innings = data.scorecard[0];
  const inningsKey = innings.inningsid;
  const currRuns = innings.score;
  const currWkts = innings.wickets;
  const currOvers = innings.overs; // already number
  const currBallnbr = innings.ballnbr ?? 0;
  const battingTeam = innings.batteamname; // "South Africa" / "India"
  const bowlingTeam = battingTeam === "India" ? "South Africa" : "India"; // OK for IND vs RSA
  const currBatsmanMap = buildBatsmanMap(innings);
  const activeBatsmen = getActiveBatsmen(innings);
  const currentBowler = getCurrentBowler(innings);
  const currPartnership = getCurrentPartnership(innings);
  const currPartnershipRuns = currPartnership?.totalruns ?? 0;

  const prev = { ...last };
  const newLast = { ...last }; // we’ll mutate this then assign at end

  // ---------- TOSS (only once) ----------
  if (!newLast.tossTweeted && typeof data.status === "string") {
    const toss = parseTossFromStatus(data.status);
    if (toss) {
      newLast.tossTweeted = true;
      // snapshot update
      newLast.inningsKey = inningsKey;
      newLast.runs = currRuns;
      newLast.wickets = currWkts;
      newLast.overs = currOvers;
      newLast.ballnbr = currBallnbr;
      newLast.batsmanMap = currBatsmanMap;
      newLast.partnershipRuns = currPartnershipRuns;
      last = newLast;
      return {
        type: "TOSS",
        battingTeam,
        bowlingTeam,
        ...toss,
      };
    }
  }

  // ---------- Session (Lunch / Tea / Stumps / Drinks) ----------
  const statusLower = (data.status || "").toLowerCase();
  if (statusLower.includes("lunch") && newLast.session !== "LUNCH") {
    newLast.session = "LUNCH";
    newLast.inningsKey = inningsKey;
    newLast.runs = currRuns;
    newLast.wickets = currWkts;
    newLast.overs = currOvers;
    newLast.ballnbr = currBallnbr;
    newLast.batsmanMap = currBatsmanMap;
    newLast.partnershipRuns = currPartnershipRuns;
    last = newLast;
    return {
      type: "SESSION",
      session: "LUNCH",
      battingTeam,
      bowlingTeam,
      runs: currRuns,
      wickets: currWkts,
      overs: currOvers,
    };
  }
  if (statusLower.includes("tea") && newLast.session !== "TEA") {
    newLast.session = "TEA";
    newLast.inningsKey = inningsKey;
    newLast.runs = currRuns;
    newLast.wickets = currWkts;
    newLast.overs = currOvers;
    newLast.ballnbr = currBallnbr;
    newLast.batsmanMap = currBatsmanMap;
    newLast.partnershipRuns = currPartnershipRuns;
    last = newLast;
    return {
      type: "SESSION",
      session: "TEA",
      battingTeam,
      bowlingTeam,
      runs: currRuns,
      wickets: currWkts,
      overs: currOvers,
    };
  }
  if (statusLower.includes("stumps") && newLast.session !== "STUMPS") {
    newLast.session = "STUMPS";
    newLast.inningsKey = inningsKey;
    newLast.runs = currRuns;
    newLast.wickets = currWkts;
    newLast.overs = currOvers;
    newLast.ballnbr = currBallnbr;
    newLast.batsmanMap = currBatsmanMap;
    newLast.partnershipRuns = currPartnershipRuns;
    last = newLast;
    return {
      type: "SESSION",
      session: "STUMPS",
      battingTeam,
      bowlingTeam,
      runs: currRuns,
      wickets: currWkts,
      overs: currOvers,
    };
  }

  // ---------- First-time init / innings change ----------
  if (!prev.inningsKey) {
    newLast.inningsKey = inningsKey;
    newLast.runs = currRuns;
    newLast.wickets = currWkts;
    newLast.overs = currOvers;
    newLast.ballnbr = currBallnbr;
    newLast.batsmanMap = currBatsmanMap;
    newLast.partnershipRuns = currPartnershipRuns;
    last = newLast;
    return null;
  }

  if (inningsKey !== prev.inningsKey) {
    newLast.inningsKey = inningsKey;
    newLast.runs = currRuns;
    newLast.wickets = currWkts;
    newLast.overs = currOvers;
    newLast.ballnbr = currBallnbr;
    newLast.batsmanMap = currBatsmanMap;
    newLast.partnershipRuns = currPartnershipRuns;
    newLast.playerMilestones = {};
    newLast.partnershipMultiple = 0;
    last = newLast;
    return {
      type: "INNINGS_CHANGE",
      battingTeam,
      bowlingTeam,
    };
  }

  // ---------- Match complete ----------
  if (data.ismatchcomplete && !newLast.matchComplete) {
    newLast.matchComplete = true;
    newLast.inningsKey = inningsKey;
    newLast.runs = currRuns;
    newLast.wickets = currWkts;
    newLast.overs = currOvers;
    newLast.ballnbr = currBallnbr;
    newLast.batsmanMap = currBatsmanMap;
    newLast.partnershipRuns = currPartnershipRuns;

    // crude winner parse from status like "India won by 5 wickets"
    let winner = null;
    const m = (data.status || "").match(/^([^,]+?)\s+won by/i);
    if (m) winner = m[1].trim();

    last = newLast;
    return {
      type: "MATCH_END",
      battingTeam,
      bowlingTeam,
      winner,
      status: data.status,
    };
  }

  // ---------- WICKET detection ----------
  let event = null;

  if (currWkts > prev.wickets) {
    // find newly out batsman
    const prevMap = prev.batsmanMap || {};
    let outBatsman = null;

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
      const bowler = extractBowlerFromOutdec(outBatsman.outdec);
      const fielder = extractFielderFromOutdec(outBatsman.outdec);

      event = {
        type: "WICKET",
        battingTeam,
        bowlingTeam,
        batsman: outBatsman.name,
        howout: outBatsman.outdec,
        bowler,
        fielder,
        runs: currRuns,
        wickets: currWkts,
        overs: currOvers,
      };
    }
  }

  // ---------- SIX / FOUR detection (based on batsman stats) ----------
  if (!event) {
    const prevMap = prev.batsmanMap || {};

    // check SIX first (higher impact)
    for (const b of activeBatsmen) {
      const prevB = prevMap[b.id];
      if (prevB && b.sixes > prevB.sixes) {
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

    // then FOUR
    if (!event) {
      for (const b of activeBatsmen) {
        const prevB = prevMap[b.id];
        if (prevB && b.fours > prevB.fours) {
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
  }

  // ---------- Batter milestones (50/100/150/200...) ----------
  if (!event) {
    const prevMap = prev.batsmanMap || {};
    const milestones = [50, 100, 150, 200, 250];

    if (!newLast.playerMilestones)
      newLast.playerMilestones = { ...last.playerMilestones };

    for (const b of innings.batsman || []) {
      const prevB = prevMap[b.id] || { runs: 0 };
      const prevRuns = prevB.runs || 0;
      const curr = b.runs;

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

  // ---------- Partnership milestones (multiples of 50) ----------
  if (!event && currPartnershipRuns > 0) {
    const prevPRuns = prev.partnershipRuns || 0;
    const prevMultiple = Math.floor(prevPRuns / 50);
    const currMultiple = Math.floor(currPartnershipRuns / 50);

    if (currMultiple > prevMultiple && currMultiple > 0 && currPartnership) {
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

  // ---------- Update snapshot ----------
  newLast.inningsKey = inningsKey;
  newLast.runs = currRuns;
  newLast.wickets = currWkts;
  newLast.overs = currOvers;
  newLast.ballnbr = currBallnbr;
  newLast.batsmanMap = currBatsmanMap;
  newLast.partnershipRuns = currPartnershipRuns;

  last = newLast;
  return event;
}
