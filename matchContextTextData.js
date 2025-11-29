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
    type: "WICKET",
    batterId: 15273,
    batterName: "Virat Kohli",
    runs: 31,
    balls: 14,
    ballNbr: 35,
    currentOver: "5.5",
    commentaryTexts: [
      "starc to Virat Kohli, B0$ Caught by Steve smith!! Kohli falls to the reverse-sweep. The pressure in this over gets to him. It's full just outside off, he looks to reverse-sweep and doesn't get hold of it, to the right of backward point who runs and takes it two-handed. Simple catch and that breaks the big stand. Time for B1$ as well. B2$",
    ],
    bowlerName: "Mitchell starc",
    overs: 5.5,
  },

  players: {
    striker: "Virat Kohli",
    nonStriker: "Rohit Sharma",
    bowler: "Mitchell starc",
  },
};

export const matchContextData_australia_batting = {
  match: {
    name: "Australia vs India",
    team1: "Australia",
    team2: "India",
    team1Short: "AUS",
    team2Short: "IND",
    format: "T20",
    isMatchComplete: false,
    status: "Australia need 78 runs in 52 balls",
  },

  innings: {
    inningsid: 2,
    runs: 122,
    wickets: 2,
    overs: 11.4,
    batteamname: "Australia",
    batteamsname: "AUS",
    target: 200,

    partnership: {
      totalRuns: 42,
      totalBalls: 26,
      bat1: { name: "Travis Head", runs: 25, balls: 14 },
      bat2: { name: "Mitchell Marsh", runs: 17, balls: 12 },
    },

    batsman: [
      {
        name: "Travis Head",
        runs: 45,
        balls: 27,
        fours: 5,
        sixes: 2,
      },
      {
        name: "Mitchell Marsh",
        runs: 22,
        balls: 15,
        fours: 2,
        sixes: 1,
      },
    ],

    targetInning: {
      targetRuns: 200,
      targetWicket: 4,
      targetOvers: 20,
      battingTeamName: "India",
      battingTeamShortName: "IND",
    },
  },

  event: {
    type: "SIX",
    batterId: 94101,
    batterName: "Travis Head",
    runs: 45,
    balls: 27,
    ballNbr: 70,
    currentOver: "11.4",
    commentaryTexts: [
      "Jasprit Bumrah to Travis Head, B0$, full on leg, Head picks it early and launches it over long-on — massive hit!",
    ],
    bowlerName: "Jasprit Bumrah",
    overs: 11.4,
  },

  // WICKET example (you can uncomment to test)
  /*
  event: {
    type: "WICKET",
    batterId: 94101,
    batterName: "Travis Head",
    runs: 45,
    balls: 27,
    ballNbr: 70,
    currentOver: "11.4",
    commentaryTexts: [
      "Bumrah to Travis Head, B$1 caught behind! Extra bounce outside off, Head slashes hard and edges to KL Rahul who takes a sharp catch behind the stumps."
    ],
    bowlerName: "Jasprit Bumrah",
    overs: 11.4,
  },
  */

  players: {
    striker: "Travis Head",
    nonStriker: "Mitchell Marsh",
    bowler: "Jasprit Bumrah",
  },
};

export const matchContextData_pakistan_batting = {
  match: {
    name: "India vs Pakistan",
    team1: "India",
    team2: "Pakistan",
    team1Short: "IND",
    team2Short: "PAK",
    format: "T20",
    isMatchComplete: false,
    status: "Pakistan need 91 runs in 54 balls",
  },

  innings: {
    inningsid: 2,
    runs: 109,
    wickets: 2,
    overs: 10.0,
    batteamname: "Pakistan",
    batteamsname: "PAK",
    target: 200,

    partnership: {
      totalRuns: 38,
      totalBalls: 22,
      bat1: { name: "Babar Azam", runs: 22, balls: 15 },
      bat2: { name: "Mohammad Rizwan", runs: 16, balls: 7 },
    },

    batsman: [
      {
        name: "Babar Azam",
        runs: 41,
        balls: 28,
        fours: 4,
        sixes: 1,
      },
      {
        name: "Mohammad Rizwan",
        runs: 28,
        balls: 14,
        fours: 2,
        sixes: 1,
      },
    ],

    targetInning: {
      targetRuns: 200,
      targetWicket: 5,
      targetOvers: 20,
      battingTeamName: "India",
      battingTeamShortName: "IND",
    },
  },

  event: {
    type: "FOUR",
    batterId: 92101,
    batterName: "Babar Azam",
    runs: 41,
    balls: 28,
    ballNbr: 60,
    currentOver: "10.0",
    commentaryTexts: [
      "Arshdeep Singh to Babar Azam, B0$, short outside off, Babar rides the bounce and cuts it behind point for a boundary.",
    ],
    bowlerName: "Arshdeep Singh",
    overs: 10.0,
  },

  /*
  // Uncomment to test WICKET event
  event: {
    type: "WICKET",
    batterId: 92101,
    batterName: "Babar Azam",
    runs: 41,
    balls: 28,
    ballNbr: 60,
    currentOver: "10.0",
    commentaryTexts: [
      "Arshdeep Singh to Babar Azam, B$1 caught by Kohli! Full and angling in, Babar flicks but finds mid-wicket perfectly, and Kohli makes no mistake."
    ],
    bowlerName: "Arshdeep Singh",
    overs: 10.0,
  },
  */

  players: {
    striker: "Babar Azam",
    nonStriker: "Mohammad Rizwan",
    bowler: "Arshdeep Singh",
  },
};

export const matchContextData_handleNull = {
  match: {
    name: "Ajman Titans vs UAE Bulls",
    team1: "Ajman Titans",
    team2: "UAE Bulls",
    team1Short: "AMT",
    team2Short: "UBL",
    format: "T20",
    status: "Ajman Titans need 95 runs in 29 balls",
    venue: "",
    isMatchComplete: false,
  },
  innings: {
    inningsid: 2,
    runs: 68,
    wickets: 2,
    overs: 5.2,
    batteamname: "Ajman Titans",
    batteamsname: "AMT",
    partnership: {
      totalRuns: 68,
      totalBalls: 31,
      bat1: {
        name: "Aneurin Donald",
        runs: 31,
        balls: 13,
      },
      bat2: {
        name: "Hales",
        runs: 35,
        balls: 18,
      },
      currentRunningOver: 5.2,
    },

    targetInning: {
      targetRuns: 162,
      targetWicket: 3,
      targetOvers: 10,
      battingTeamName: "UAE Bulls",
      battingTeamShortName: "UBL",
    },
  },
  event: {
    type: "WICKET",
    batterName: "Rilee Rossouw",
    howOut: "",
    score: 68,
    wickets: 2,
    overs: 5.2,
    currentOver: "5.2",
    ballNbr: 32,
    commentaryTexts: [],
    bowlerName: "Junaid Siddique",
  },
  players: {
    striker: "Rilee Rossouw",
    nonStriker: "",
    strikerRuns: "",
    strikerBallsPlayed: "",
    nonStrikerRuns: "",
    nonStrikerBallsPlayed: "",
    bowler: "Junaid Siddique",
  },
};

export const matchContextData_fistInning = {
  match: {
    name: "Melbourne Renegades Women vs Perth Scorchers Women",
    team1: "Melbourne Renegades Women",
    team2: "Perth Scorchers Women",
    format: "T20",
    status: "Perth Scorchers Women opt to bowl",
    venue: "",
  },
  innings: {
    inningsid: 1,

    extras: { legbyes: 0, byes: 0, wides: 7, noballs: 0, penalty: 0, total: 7 },
    pp: { powerplay: [Array] },
    runs: 32,
    wickets: 3,
    overs: 4.5,
    runrate: 6.62,
    batteamname: "Melbourne Renegades Women",
    batteamsname: "MLRW",
    isdeclared: false,
    isfollowon: false,
    ballnbr: 29,
    rpb: 1.1,
    partnership: { partnership: [Array] },
  },
  event: {
    type: "WICKET",
    batterName: "Emma de Broughe",
    howOut: "batting",
    score: 32,
    wickets: 3,
    overs: 4.5,
  },
  players: {
    striker: "Emma de Broughe",
    nonStriker: "Alice Capsey",
    bowler: "Sophie Devine",
    strikerRuns: 10,
    strikerBallsPlayed: 11,
    nonStrikerRuns: 1,
    nonStrikerBallsPlayed: 1,
  },
  raw: {
    score: {
      scorecard: [Array],
      ismatchcomplete: false,
      appindex: [Object],
      status: "Perth Scorchers Women opt to bowl",
      responselastupdated: 1764217846,
    },
    mini: {
      batsmanstriker: [Object],
      batsmannonstriker: [Object],
      bowlerstriker: [Object],
      bowlernonstriker: [Object],
      crr: 6.86,
      rrr: 0,
      inningsnbr: "1st inn",
      lastwkt: "Sophie Molineux  c Freya Kemp b Devine 5(6)  - 31/2 in 4.3 ov.",
      curovsstats: "... 3  | 0 W 0 4 1 4  | 0 Wd 0 W 1",
      inningsscores: [Object],
      inningsid: 1,
      performance: [],
      partnership: "1(1)",
      oversrem: "",
      pp: [Object],
      target: 0,
      custstatus: "",
      ballsrem: 0,
      rpb: 0,
      rrpb: 0,
      responselastupdated: 0,
      event: "",
    },
  },
};
