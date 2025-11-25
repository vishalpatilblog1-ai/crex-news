export const matchContextTestMatchArray = [
  // 1) FOUR – Full valid data
  {
    match: {
      name: "IND vs SA",
      format: "TEST",
      team1: "India",
      team2: "South Africa",
    },
    innings: {
      battingTeam: "IND",
      runs: 105,
      wickets: 2,
      overs: "31.2",
      trailOrLeadText: "Day 2 - India trail by 290 runs",
    },
    ball: {
      text: "Rabada to Rohit Sharma, FOUR! Timed through midwicket.",
      eventtype: "FOUR",
      partnership: "62(88)",
    },
    players: {
      striker: "Rohit Sharma",
      strikerRuns: "55",
      strikerBallsPlayed: "72",
      nonStriker: "Shubman Gill",
      nonStrikerRuns: "35",
      nonStrikerBallsPlayed: "60",
    },
  },

  // 2) SIX – Big shot
  {
    match: {
      name: "IND vs AUS",
      format: "TEST",
      team1: "India",
      team2: "Australia",
    },
    innings: {
      battingTeam: "IND",
      runs: 210,
      wickets: 4,
      overs: "55.1",
      trailOrLeadText: "Day 3 - India lead by 45 runs",
    },
    ball: {
      text: "Hazlewood to Iyer, SIX! Launched over long-on!",
      eventtype: "SIX",
      partnership: "22(37)",
    },
    players: {
      striker: "Shreyas Iyer",
      strikerRuns: "39",
      strikerBallsPlayed: "68",
      nonStriker: "Ravindra Jadeja",
      nonStrikerRuns: "12",
      nonStrikerBallsPlayed: "24",
    },
  },

  // 3) WICKET – Full batsman data
  {
    match: {
      name: "IND vs ENG",
      format: "TEST",
      team1: "India",
      team2: "England",
    },
    innings: {
      battingTeam: "IND",
      runs: 88,
      wickets: 3,
      overs: "25.6",
      trailOrLeadText: "Day 1 - Lunch Break",
    },
    ball: {
      text: "Anderson to Rahul, OUT! Edged and gone!",
      eventtype: "WICKET",
      partnership: "15(29)",
    },
    players: {
      striker: "KL Rahul",
      strikerRuns: "22",
      strikerBallsPlayed: "47",
      nonStriker: "Virat Kohli",
      nonStrikerRuns: "10",
      nonStrikerBallsPlayed: "21",
    },
  },

  // 4) NEW BATSMAN – Missing balls for non-striker
  {
    match: {
      name: "NZ vs IND",
      format: "TEST",
      team1: "New Zealand",
      team2: "India",
    },
    innings: {
      battingTeam: "IND",
      runs: 31,
      wickets: 1,
      overs: "12.0",
      trailOrLeadText: "Day 1 - IND trail by 289 runs",
    },
    ball: {
      text: "Boult to Pujara, no run.",
      eventtype: "six",
      partnership: "0(5)",
    },
    players: {
      striker: "Cheteshwar Pujara",
      strikerRuns: "0",
      strikerBallsPlayed: "5",
      nonStriker: "Rohit Sharma",
      nonStrikerRuns: "20",
      nonStrikerBallsPlayed: undefined,
    },
  },

  // 5) Partnership missing (undefined)
  {
    match: {
      name: "IND vs BAN",
      format: "TEST",
      team1: "India",
      team2: "Bangladesh",
    },
    innings: {
      battingTeam: "IND",
      runs: 150,
      wickets: 5,
      overs: "45.3",
      trailOrLeadText: "Day 2 - Tea",
    },
    ball: {
      text: "Taijul to Pant, FOUR! Reverse swept!",
      eventtype: "FOUR",
      partnership: undefined,
    },
    players: {
      striker: "Rishabh Pant",
      strikerRuns: "33",
      strikerBallsPlayed: "48",
      nonStriker: "Ravichandran Ashwin",
      nonStrikerRuns: "12",
      nonStrikerBallsPlayed: "19",
    },
  },

  // 6) No batsman data at all
  {
    match: {
      name: "SA vs IND",
      format: "TEST",
      team1: "South Africa",
      team2: "India",
    },
    innings: {
      battingTeam: "RSA",
      runs: 190,
      wickets: 6,
      overs: "62.4",
      trailOrLeadText: "Day 2 - SA trail by 80 runs",
    },
    ball: {
      text: "Siraj to Jansen, WICKET! Bowled him!",
      eventtype: "WICKET",
      partnership: "12(22)",
    },
    players: {
      striker: undefined,
      strikerRuns: undefined,
      strikerBallsPlayed: undefined,
      nonStriker: undefined,
      nonStrikerRuns: undefined,
      nonStrikerBallsPlayed: undefined,
    },
  },

  // 7) Over break (SKIP)
  {
    match: {
      name: "IND vs WI",
      format: "TEST",
      team1: "India",
      team2: "West Indies",
    },
    innings: {
      battingTeam: "IND",
      runs: 300,
      wickets: 7,
      overs: "95.0",
      trailOrLeadText: "Day 3 - Stumps",
    },
    ball: {
      text: "End of over 95.",
      eventtype: "six",
      partnership: "55(103)",
    },
    players: { striker: "Washington Sundar", nonStriker: "Jasprit Bumrah" },
  },

  // 8) Dot ball with full valid data
  {
    match: {
      name: "IND vs SL",
      format: "TEST",
      team1: "India",
      team2: "Sri Lanka",
    },
    innings: {
      battingTeam: "IND",
      runs: 17,
      wickets: 0,
      overs: "7.4",
      trailOrLeadText: "Day 1 - Morning Session",
    },
    ball: {
      text: "Kumara to Rohit, no run.",
      eventtype: "six",
      partnership: "17(44)",
    },
    players: {
      striker: "Rohit Sharma",
      strikerRuns: "9",
      strikerBallsPlayed: "28",
      nonStriker: "Yashasvi Jaiswal",
      nonStrikerRuns: "7",
      nonStrikerBallsPlayed: "16",
    },
  },

  // 9) Same last name (Pandya brothers)
  {
    match: {
      name: "IND vs ENG",
      format: "TEST",
      team1: "India",
      team2: "England",
    },
    innings: {
      battingTeam: "IND",
      runs: 205,
      wickets: 5,
      overs: "68.3",
      trailOrLeadText: "Day 3",
    },
    ball: {
      text: "Wood to Hardik Pandya, FOUR!",
      eventtype: "FOUR",
      partnership: "33(41)",
    },
    players: {
      striker: "Hardik Pandya",
      strikerRuns: "22",
      strikerBallsPlayed: "38",
      nonStriker: "Krunal Pandya",
      nonStrikerRuns: "11",
      nonStrikerBallsPlayed: "21",
    },
  },

  // 10) One batsman valid, other missing → no partnership
  {
    match: {
      name: "IND vs ZIM",
      format: "TEST",
      team1: "India",
      team2: "Zimbabwe",
    },
    innings: {
      battingTeam: "IND",
      runs: 9,
      wickets: 1,
      overs: "3.1",
      trailOrLeadText: "Day 1",
    },
    ball: {
      text: "Mumba to Gill, no run.",
      eventtype: "six",
      partnership: "4(12)",
    },
    players: {
      striker: "Shubman Gill",
      strikerRuns: "6",
      strikerBallsPlayed: "11",
      nonStriker: "Rohit Sharma",
      nonStrikerRuns: undefined,
      nonStrikerBallsPlayed: undefined,
    },
  },
];
export const matchContextT20Array = [
  // 1) FOUR – perfect ball, full data
  {
    match: {
      name: "IND vs AUS",
      format: "T20",
      team1: "India",
      team2: "Australia",
    },
    innings: {
      battingTeam: "IND",
      runs: 62,
      wickets: 1,
      overs: "7.3",
      trailOrLeadText: "IND cruising at 8.26 RPO",
    },
    ball: {
      text: "Hazlewood to Rohit Sharma, FOUR! Crunched through covers.",
      eventtype: "FOUR",
      partnership: "35(21)",
    },
    players: {
      striker: "Rohit Sharma",
      strikerRuns: "31",
      strikerBallsPlayed: "16",
      nonStriker: "Yashasvi Jaiswal",
      nonStrikerRuns: "18",
      nonStrikerBallsPlayed: "12",
    },
  },

  // 2) SIX – explosive T20 shot
  {
    match: {
      name: "IND vs WI",
      format: "T20",
      team1: "India",
      team2: "West Indies",
    },
    innings: {
      battingTeam: "IND",
      runs: 98,
      wickets: 2,
      overs: "11.4",
      trailOrLeadText: "IND scoring at 8.40 RPO",
    },
    ball: {
      text: "Holder to Suryakumar Yadav, SIX! Trademark SKY pick-up over fine leg!",
      eventtype: "SIX",
      partnership: "28(17)",
    },
    players: {
      striker: "Suryakumar Yadav",
      strikerRuns: "22",
      strikerBallsPlayed: "10",
      nonStriker: "Rishabh Pant",
      nonStrikerRuns: "15",
      nonStrikerBallsPlayed: "9",
    },
  },

  // 3) WICKET – full data
  {
    match: {
      name: "PAK vs IND",
      format: "T20",
      team1: "Pakistan",
      team2: "India",
    },
    innings: {
      battingTeam: "IND",
      runs: 45,
      wickets: 2,
      overs: "5.5",
      trailOrLeadText: "Powerplay underway",
    },
    ball: {
      text: "Shaheen Afridi to Kohli, OUT! Edged to the keeper!",
      eventtype: "WICKET",
      partnership: "12(9)",
    },
    players: {
      striker: "Virat Kohli",
      strikerRuns: "10",
      strikerBallsPlayed: "8",
      nonStriker: "Rohit Sharma",
      nonStrikerRuns: "22",
      nonStrikerBallsPlayed: "13",
    },
  },

  // 4) NEW BATSMAN – missing data for non-striker
  {
    match: {
      name: "NZ vs IND",
      format: "T20",
      team1: "New Zealand",
      team2: "India",
    },
    innings: {
      battingTeam: "IND",
      runs: 12,
      wickets: 1,
      overs: "2.1",
      trailOrLeadText: "Early phase",
    },
    ball: {
      text: "Southee to Shubman Gill, no run.",
      eventtype: "NONE",
      partnership: "4(7)",
    },
    players: {
      striker: "Shubman Gill",
      strikerRuns: "4",
      strikerBallsPlayed: "7",
      nonStriker: "Rohit Sharma",
      nonStrikerRuns: "7",
      nonStrikerBallsPlayed: undefined,
    },
  },

  // 5) Partnership missing (undefined)
  {
    match: {
      name: "IND vs BAN",
      format: "T20",
      team1: "India",
      team2: "Bangladesh",
    },
    innings: {
      battingTeam: "IND",
      runs: 78,
      wickets: 3,
      overs: "9.2",
      trailOrLeadText: "Middle overs",
    },
    ball: {
      text: "Mustafizur to Rinku Singh, FOUR! Wristy flick!",
      eventtype: "FOUR",
      partnership: undefined,
    },
    players: {
      striker: "Rinku Singh",
      strikerRuns: "18",
      strikerBallsPlayed: "10",
      nonStriker: "Hardik Pandya",
      nonStrikerRuns: "5",
      nonStrikerBallsPlayed: "6",
    },
  },

  // 6) No batsman data at all (after wicket)
  {
    match: {
      name: "SA vs IND",
      format: "T20",
      team1: "South Africa",
      team2: "India",
    },
    innings: {
      battingTeam: "IND",
      runs: 121,
      wickets: 6,
      overs: "15.4",
      trailOrLeadText: "Death overs approaching",
    },
    ball: {
      text: "Rabada to Axar Patel, OUT! Bowled him!",
      eventtype: "WICKET",
      partnership: "9(11)",
    },
    players: {
      striker: undefined,
      strikerRuns: undefined,
      strikerBallsPlayed: undefined,
      nonStriker: undefined,
      nonStrikerRuns: undefined,
      nonStrikerBallsPlayed: undefined,
    },
  },

  // 7) Over break (SKIP)
  {
    match: {
      name: "IND vs SL",
      format: "T20",
      team1: "India",
      team2: "Sri Lanka",
    },
    innings: {
      battingTeam: "IND",
      runs: 145,
      wickets: 4,
      overs: "16.0",
      trailOrLeadText: "Strategic timeout",
    },
    ball: {
      text: "End of over 16.",
      eventtype: "OVER-BREAK",
      partnership: "44(28)",
    },
    players: {
      striker: "Tilak Varma",
      nonStriker: "Hardik Pandya",
    },
  },

  // 8) Dot ball – valid data
  {
    match: {
      name: "IND vs ENG",
      format: "T20",
      team1: "India",
      team2: "England",
    },
    innings: {
      battingTeam: "IND",
      runs: 23,
      wickets: 0,
      overs: "3.5",
      trailOrLeadText: "",
    },
    ball: {
      text: "Wood to Jaiswal, dot ball.",
      eventtype: "NONE",
      partnership: "23(23)",
    },
    players: {
      striker: "Yashasvi Jaiswal",
      strikerRuns: "14",
      strikerBallsPlayed: "9",
      nonStriker: "Rohit Sharma",
      nonStrikerRuns: "9",
      nonStrikerBallsPlayed: "14",
    },
  },

  // 9) Same last name – Pandya brothers
  {
    match: {
      name: "IND vs IRE",
      format: "T20",
      team1: "India",
      team2: "Ireland",
    },
    innings: {
      battingTeam: "IND",
      runs: 112,
      wickets: 5,
      overs: "13.0",
      trailOrLeadText: "",
    },
    ball: {
      text: "Young to Hardik Pandya, FOUR!",
      eventtype: "FOUR",
      partnership: "21(13)",
    },
    players: {
      striker: "Hardik Pandya",
      strikerRuns: "19",
      strikerBallsPlayed: "9",
      nonStriker: "Krunal Pandya",
      nonStrikerRuns: "5",
      nonStrikerBallsPlayed: "7",
    },
  },

  // 10) One batsman OK, one missing
  {
    match: {
      name: "IND vs ZIM",
      format: "T20",
      team1: "India",
      team2: "Zimbabwe",
    },
    innings: {
      battingTeam: "IND",
      runs: 7,
      wickets: 1,
      overs: "1.5",
      trailOrLeadText: "",
    },
    ball: {
      text: "Chatara to Shubman Gill, no run.",
      eventtype: "NONE",
      partnership: "3(7)",
    },
    players: {
      striker: "Shubman Gill",
      strikerRuns: "3",
      strikerBallsPlayed: "7",
      nonStriker: "Ruturaj Gaikwad",
      nonStrikerRuns: undefined,
      nonStrikerBallsPlayed: undefined,
    },
  },
];
