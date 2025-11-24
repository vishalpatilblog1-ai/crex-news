// import generateTweet from "./ai.js";

import generateTweet from "./ai.js";

const matchContextArray = [
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
      eventtype: "NONE",
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
      eventtype: "OVER-BREAK",
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
      eventtype: "NONE",
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
      eventtype: "NONE",
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

async function test() {
  matchContextArray.map(async (item) => {
    const tweet = await generateTweet(item);

    console.log("\n=======================");
    console.log("FINAL GENERATED TWEET:");
    console.log("=======================\n");
    console.log(tweet);
  });
  //   const tweet = await generateTweet(matchContext3);

  //   console.log("\n=======================");
  //   console.log("FINAL GENERATED TWEET:");
  //   console.log("=======================\n");
  //   console.log(tweet);
}

test();
