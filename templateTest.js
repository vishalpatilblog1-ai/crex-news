// templateTest.js
import generateTweet from "./ai.js";
import { postTweet } from "./Puppeteer/postTweet.js";
import { initPuppeteer } from "./Puppeteer/postTweet.js";

async function runTemplateTests() {
  console.log("🚀 Running Tweet Template Tests…");

  await initPuppeteer();

  const tests = [
    {
      label: "WICKET",
      data: {
        type: "WICKET",
        batsman: "Rohit Sharma",
        bowler: "Mitchell Starc",
        runs: 45,
        wickets: 3,
        overs: 12.4,
        battingTeam: "India",
        bowlingTeam: "South Africa",
        team1: "IND",
        team2: "SA",
      },
    },
    {
      label: "FOUR",
      data: {
        type: "FOUR",
        batsman: "Ruturaj Gaikwad",
        runs: 49,
        wickets: 2,
        overs: 8.2,
        battingTeam: "India",
        bowlingTeam: "South Africa",
        team1: "IND",
        team2: "SA",
      },
    },
    {
      label: "SIX",
      data: {
        type: "SIX",
        batsman: "MS Dhoni",
        runs: 74,
        wickets: 1,
        overs: 10.1,
        battingTeam: "India",
        bowlingTeam: "South Africa",
        team1: "IND",
        team2: "SA",
      },
    },
    {
      label: "FIFTY",
      data: {
        type: "MILESTONE",
        milestone: "FIFTY",
        batsman: "KL Rahul",
        runs: 50,
        balls: 32,
        battingTeam: "India",
        bowlingTeam: "South Africa",
        team1: "IND",
        team2: "SA",
      },
    },
    {
      label: "HUNDRED",
      data: {
        type: "MILESTONE",
        milestone: "HUNDRED",
        batsman: "Yuvraj Singh",
        runs: 100,
        balls: 78,
        battingTeam: "India",
        bowlingTeam: "South Africa",
        team1: "IND",
        team2: "SA",
      },
    },
    {
      label: "SESSION",
      data: {
        type: "SESSION",
        session: "STUMPS",
        battingTeam: "India",
        bowlingTeam: "South Africa",
        runs: 250,
        wickets: 6,
        overs: 90,
        team1: "IND",
        team2: "SA",
      },
    },
    {
      label: "INNINGS BREAK",
      data: {
        type: "INNINGS_BREAK",
        battingTeam: "India",
        bowlingTeam: "South Africa",
        runs: 320,
        wickets: 9,
        overs: 50,
        team1: "IND",
        team2: "SA",
      },
    },
    {
      label: "RESULT",
      data: {
        type: "RESULT",
        winner: "India",
        margin: "5 wickets",
        target: 160,
        score: "161/5",
        opponent: "South Africa",
        team1: "IND",
        team2: "SA",
      },
    },
    {
      label: "PAKISTAN RESULT (No emojis)",
      data: {
        type: "RESULT",
        winner: "Pakistan",
        margin: "5 wickets",
        target: 138,
        score: "139/5",
        opponent: "Zimbabwe",
        team1: "PAK",
        team2: "ZIM",
      },
    },
  ];

  for (const test of tests) {
    console.log(`\n============================`);
    console.log(`🎯  Testing: ${test.label}`);
    console.log(`============================`);

    const tweet = await generateTweet(test.data);

    console.log("📝 Generated Tweet:");
    console.log(tweet);

    // Uncomment to actually post tweet:
    // await postTweet(tweet);

    await new Promise((res) => setTimeout(res, 2500));
  }

  console.log("\n✅ All template tests completed!");
}

runTemplateTests();
