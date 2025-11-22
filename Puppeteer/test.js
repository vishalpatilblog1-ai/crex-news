import { startBrowser } from "./browser.js";
import { fetchScorecard } from "./fetchCricbuzzViaBrowser.js";
import { findAnyLiveMatch } from "./findAnyLiveMatch.js";

console.log("➡ Starting browser...");
await startBrowser();

console.log("🔎 Searching for ANY live match…");
const live = await findAnyLiveMatch();

if (!live) {
  console.log("❌ No live match found.");
  process.exit(0);
}

console.log(`✅ Live match found: ${live.name}`);
console.log(`🏏 MATCH_ID: ${live.id}`);

console.log("➡ Fetching scorecard...");
const s = await fetchScorecard(live.id);

console.log("RESULT:\n", JSON.stringify(s, null, 2));
