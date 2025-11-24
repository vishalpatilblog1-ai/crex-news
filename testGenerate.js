// import generateTweet from "./ai.js";

import generateTweet from "./ai.js";

const matchContext5 = {
  match: {
    name: "India vs South Africa",
    format: "TEST",
    status: "Day 2: 1st Session - India trail by 210 runs",
    venue: "",
    team1: "India",
    team2: "South Africa",
  },
  innings: {
    battingTeam: "IND",
    bowlingTeam: "RSA",
    runs: 78,
    wickets: 2,
    overs: 25.4,
    target: 0,
    crr: 3.04,
    rrr: 0,
    trailOrLeadText: "Day 2: 1st Session - India trail by 210 runs",
  },
  ball: {
    text: "Ngidi to Yashasvi Jaiswal, FOUR! Crunched through cover.",
    eventtype: "FOUR",
    overnum: 25.4,
    inningsid: 2,
    ballnbr: 154,
    partnership: "45(48)",
  },
  players: {
    striker: "Yashasvi Jaiswal",
    nonStriker: "Shubman Gill",
    bowler: "Lungi Ngidi",
    strikerRuns: "42",
    strikerBallsPlayed: "63",
    nonStrikerRuns: "28",
    nonStrikerBallsPlayed: "51",
  },
};

async function test() {
  const tweet = await generateTweet(matchContext5);

  console.log("\n=======================");
  console.log("FINAL GENERATED TWEET:");
  console.log("=======================\n");
  console.log(tweet);
}

test();
