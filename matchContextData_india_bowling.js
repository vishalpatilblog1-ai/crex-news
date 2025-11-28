export const matchContextData_india_bowling = {
  match: {
    name: "India vs Pakistan",
    team1: "India",
    team2: "Pakistan",
    team1Short: "IND",
    team2Short: "PAK",
    format: "T20",
    isMatchComplete: false,
    status: "Pakistan need 72 runs in 68 balls",
  },

  innings: {
    inningsid: 2,
    runs: 145,
    wickets: 3,
    overs: 18.2,
    batteamname: "Pakistan",
    batteamsname: "PAK",
    target: 200,

    partnership: {
      totalRuns: 50,
      totalBalls: 8,
      bat1: { name: "Shahid Afridi", runs: 9, balls: 7 },
      bat2: { name: "Babar Azam", runs: 0, balls: 1 },
    },

    batsman: [
      {
        name: "Shahid Afridi",
        runs: 69,
        balls: 49,
        fours: 5,
        sixes: 4,
      },
      {
        name: "Babar Azam",
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
      battingTeamName: "Pakistan",
      battingTeamShortName: "PAK",
    },
  },

  event: {
    type: "WICKET",
    batterName: "Babar Azam",
    runs: 7,
    balls: 3,
    bowlerName: "Arshdip Singh",
  },

  players: {
    striker: "Babar Azam",
    nonStriker: "Shahid Afridi",
    bowler: "Arshdip Singh",
  },
};
