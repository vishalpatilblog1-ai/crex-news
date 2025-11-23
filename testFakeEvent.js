import generateTweet from "./ai.js";
import postTweet from "./twitter.js";
import { buildFinalTweet } from "./utils/matchFormatting.js";

// 🎯 Fake event JSON (just like live events)
const fakeEvent = {
  type: "PARTNERSHIP",
  batsman1: "Ruturaj Gaikwad",
  batsman2: "Shubman Gill",
  runs: 52,
  overs: "8.2",
  battingTeam: "India",
  bowlingTeam: "South Africa",
};

async function test() {
  console.log("🔧 Running FAKE EVENT TEST...");

  try {
    const generated = await generateTweet(fakeEvent);
    console.log("🧠 AI Tweet:", generated);

    const finalText = buildFinalTweet("India vs South Africa", generated);
    console.log("\n📦 Final Tweet Sent:\n", finalText);

    const posted = await postTweet(finalText);
    console.log("🐦 Tweet posted! ID:", posted?.id);
  } catch (err) {
    console.error("❌ TEST FAILED:", err);
  }
}

test();
