export const matchContextData_india_batting = {
  match: {
    name: "India vs Australia",
    team1: "India",
    team2: "Australia",
    team1Short: "IND",
    team2Short: "AUS",
    format: "T20",
    isMatchComplete: false,
    status: "India need 72 runs in 68 balls",
  },

  innings: {
    inningsid: 2,
    runs: 145,
    wickets: 3,
    overs: 18.2,
    batteamname: "India",
    batteamsname: "IND",
    target: 200,

    partnership: {
      totalRuns: 50,
      totalBalls: 8,
      bat1: { name: "Rohit Sharma", runs: 9, balls: 7 },
      bat2: { name: "Virat Kohli", runs: 0, balls: 1 },
    },

    batsman: [
      {
        name: "Rohit Sharma",
        runs: 69,
        balls: 49,
        fours: 5,
        sixes: 4,
      },
      {
        name: "Virat Kohli",
        runs: 7,
        balls: 3,
        fours: 0,
        sixes: 1,
      },
    ],
    targetInning: {
      targetRuns: 203,
      targetWicket: 4,
      targetOvers: 19.3,
      battingTeamName: "Australia",
      battingTeamShortName: "AUS",
    },
  },

  event: {
    type: "FOUR",
    batterName: "Virat Kohli",
    runs: 7,
    balls: 3,
    bowlerName: "Mitchell starc",
  },

  players: {
    striker: "Virat Kohli",
    nonStriker: "Rohit Sharma",
    bowler: "Mitchell starc",
  },
};
