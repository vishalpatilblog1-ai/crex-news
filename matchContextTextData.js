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
