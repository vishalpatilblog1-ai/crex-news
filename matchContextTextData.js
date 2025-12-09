export const matchContextData_team_milestone = {
  match: {
    name: "Australia vs England",
    team1: "Australia",
    team2: "England",
    team1Short: "AUS",
    team2Short: "ENG",
    format: "TEST",
    venue: "",
    status: "Day 1: 2nd Session",
    isMatchComplete: false,
  },
  event: {
    type: "TEAM_MILESTONE",
    runs: 150,
    balls: 195,
    currentOver: "32.3",
    ballNbr: 195,
    commentaryTexts: [
      "Doggett to Brook, 1 run, 135.5kph, the line is down leg on this occasion,",
    ],
    bowlerName: "Brendan Doggett",
    inningsid: 1,
    wickets: 3,
    overs: 32.3,
    batteamname: "England",
    batteamsname: "ENG",
    partnership: {
      totalRuns: 120,
      totalBalls: 35,
      bat1: {
        name: "Rohit Sharma",
        runs: 100,
        balls: 26,
      },
      bat2: {
        name: "Perry",
        runs: 12,
        balls: 9,
      },
      currentRunningOver: 5.5,
    },

    targetInning: {
      targetRuns: 150,
      targetWicket: 3,
      targetOvers: 32.3,
      battingTeamName: "England",
      battingTeamShortName: "ENG",
    },
    series: "The Ashes, 2025-26",
  },
  players: {
    striker: "Joe Root",
    nonStriker: "Harry Brook",
    strikerRuns: "",
    strikerBallsPlayed: "",
    nonStrikerRuns: "",
    nonStrikerBallsPlayed: "",
    bowler: "Brendan Doggett",
  },
};

export const matchContextData_maiden_over = {
  match: {
    name: "Australia vs England",
    team1: "Australia",
    team2: "England",
    team1Short: "AUS",
    team2Short: "ENG",
    format: "TEST",
    venue: "",
    status: "Day 1: 2nd Session",
    isMatchComplete: false,
  },

  event: {
    type: "MAIDEN_OVER",

    // Maiden over specifics
    bowlerName: "Mitchell Starc",
    overNumber: "14.0",
    ballNbr: 84, // 14 overs * 6 balls = 84 balls

    // OPTIONAL mini-fields (empty or neutral)
    commentaryTexts: [],
    inningsid: 1,
    overs: 14.0,
    wickets: 2,
    batteamname: "England",
    batteamsname: "ENG",

    partnership: {
      totalRuns: 45,
      totalBalls: 80,
      bat1: { name: "Joe Root", runs: 22, balls: 50 },
      bat2: { name: "Harry Brook", runs: 18, balls: 30 },
      currentRunningOver: 14.0,
    },

    targetInning: {
      targetRuns: "",
      targetWicket: "",
      targetOvers: "",
      battingTeamName: "England",
      battingTeamShortName: "ENG",
    },

    series: "The Ashes, 2025-26",
  },

  players: {
    striker: "Joe Root",
    nonStriker: "Harry Brook",

    strikerRuns: "22",
    strikerBallsPlayed: "50",

    nonStrikerRuns: "18",
    nonStrikerBallsPlayed: "30",

    bowler: "Mitchell Starc",
  },
};

export const matchContextData_wicket_over = {
  match: {
    name: "Australia vs England",
    team1: "Australia",
    team2: "England",
    team1Short: "AUS",
    team2Short: "ENG",
    format: "TEST",
    venue: "",
    status: "Day 1: 2nd Session",
    isMatchComplete: false,
  },
  event: {
    type: "WICKET",
    batterName: "Harry Brook",
    bowlerName: "Mitchell Starc",
    howOut: "",
    score: 176,
    wickets: 4,
    overs: 39.2,
    currentOver: "39.2",
    ballNbr: 236,
    commentaryTexts: [],
    inningsid: 1,
    runs: 176,
    batteamname: "England",
    batteamsname: "ENG",

    partnership: {
      totalRuns: 54,
      totalBalls: 69,
      currentRunningOver: 39.2,
    },
    targetInning: {
      targetRuns: 176,
      targetWicket: 4,
      targetOvers: 39.2,
      battingTeamName: "England",
      battingTeamShortName: "ENG",
    },
    series: "The Ashes, 2025-26",
  },
  players: {
    striker: "Harry Brook",
    nonStriker: "",
    strikerRuns: "",
    strikerBallsPlayed: "",
    nonStrikerRuns: "",
    nonStrikerBallsPlayed: "",
    bowler: "Mitchell Starc",
  },
};

//=================================================================================
// 🇦🇺 AUS - 125/1 (19.5 Overs)
// 🇬🇧 ENG - 334 Runs - first innings
//=================================================================================
export const matchContextData_test_firstSession_Second_inning = {
  match: {
    name: "Australia vs England",
    team1: "Australia",
    team2: "England",
    team1Short: "AUS",
    team2Short: "ENG",
    format: "TEST",
    venue: "",
    status: "Day 2: 1st Session - Australia trail by 206 runs",
    isMatchComplete: false,
  },
  event: {
    type: "BALL_UPDATE",
    ballNbr: 126,
    currentOver: "20.6",
    currentOverString: 21,
    bowlerId: 6557,
    bowlerName: "Ben Stokes",
    bowlerOvers: "6",
    bowlerRuns: 35,
    bowlerWickets: "",
    bowlerBalls: 36,
    bowlerEconomy: "5.8",
    commentaryTexts: [],
    inningsid: 2,
    runs: 130,
    wickets: 1,
    overs: 21,
    batteamname: "Australia",
    batteamsname: "AUS",

    partnership: {
      totalRuns: 53,
      totalBalls: 47,
      currentRunningOver: 21,
    },
    targetInning: {
      targetRuns: 334,
      targetWicket: 10,
      targetOvers: 76.2,
      battingTeamName: "England",
      battingTeamShortName: "ENG",
    },
    series: "The Ashes, 2025-26",
  },
  players: {
    striker: "Jake Weatherald",
    nonStriker: "Marnus Labuschagne",
    strikerRuns: "",
    strikerBallsPlayed: "",
    nonStrikerRuns: "",
    nonStrikerBallsPlayed: "",
    bowler: "Ben Stokes",
  },
};

export const matchContextData_test_allInnings = {
  scorecard: [
    {
      inningsid: 1,
      score: 334,
      wickets: 10,
      overs: 76.2,
      runrate: 4.38,
      batteamname: "England",
      batteamsname: "ENG",
      isdeclared: false,
      isfollowon: false,
      ballnbr: 458,
      rpb: 0.73,
    },
    {
      inningsid: 2,
      score: 511,
      wickets: 10,
      overs: 117.3,
      runrate: 4.35,
      batteamname: "Australia",
      batteamsname: "AUS",
      isdeclared: false,
      isfollowon: false,
      ballnbr: 705,
      rpb: 0.72,
    },
    {
      inningsid: 3,
      score: 241,
      wickets: 10,
      overs: 75.2,
      runrate: 3.2,
      batteamname: "England",
      batteamsname: "ENG",
      isdeclared: false,
      isfollowon: false,
      ballnbr: 452,
      rpb: 0.53,
    },
    {
      inningsid: 4,
      score: 69,
      wickets: 2,
      overs: 10,
      runrate: 6.9,
      batteamname: "Australia",
      batteamsname: "AUS",
      isdeclared: false,
      isfollowon: false,
      ballnbr: 60,
      rpb: 1.15,
    },
  ],
  ismatchcomplete: true,
  appindex: {
    seotitle:
      "Cricket scorecard - AUS vs ENG 2nd Test,The Ashes, 2025-26 | Cricbuzz.com",
    weburl:
      "http://www.cricbuzz.com/live-cricket-scorecard/108793/aus-vs-eng-2nd-test-the-ashes-2025-26",
  },
  status: "Australia won by 8 wkts",
  responselastupdated: 1765118021,
};

export const matchContext_T20_firstInning = {
  match: {
    name: "Perth Scorchers Women vs Melbourne Stars Women",
    team1: "Perth Scorchers Women",
    team2: "Melbourne Stars Women",
    team1Short: "PRSW",
    team2Short: "MLSW",
    format: "T20",
    venue: "",
    status: "Perth Scorchers Women opt to bat",
    isMatchComplete: false,
  },
  event: {
    type: "FOUR",
    batterId: 12005,
    batterName: "Katie Mack",
    bowlerName: "Sasha Moloney",
    runs: 73,
    balls: 27,
    ballNbr: 57,
    currentOver: "9.3",
    commentaryTexts: ["Sasha Moloney to Katie Mack, byes, 1 run"],
    inningsid: 1,
    wickets: 0,
    overs: 9.3,
    batteamname: "Perth Scorchers Women",
    batteamsname: "PRSW",

    partnership: {
      totalRuns: 73,
      totalBalls: 57,
      bat1: {
        name: "Katie Mack",
        runs: 32,
        balls: 27,
      },
      bat2: {
        name: "Mooney",
        runs: 34,
        balls: 30,
      },
      currentRunningOver: 9.3,
    },
    targetInning: {
      targetRuns: 73,
      targetWicket: 0,
      targetOvers: 9.3,
      battingTeamName: "Perth Scorchers Women",
      battingTeamShortName: "PRSW",
    },
    series: "Womens Big Bash League 2025",
    scoreCardStatus: "Perth Scorchers Women opt to bat",
  },
  players: {
    striker: "Katie Mack",
    nonStriker: "Beth Mooney",
    strikerRuns: "",
    strikerBallsPlayed: "",
    nonStrikerRuns: "",
    nonStrikerBallsPlayed: "",
    bowler: "Sasha Moloney",
  },
};
