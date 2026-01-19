// scripts/runCaPolling.js

import { caNewsPollingLoop } from "./cricket-addictor/caNewsPollingLoop.js";
import { loadState } from "./utils/stateStoreCloud.js";

async function run() {
  console.log("🚀 Running CricketAddictor polling once...");

  // Load state (same as prod)
  global.STATE = await loadState();

  if (!global.STATE) {
    global.STATE = {};
  }

  await caNewsPollingLoop();

  console.log("✅ CA polling finished");
}

run().catch((err) => {
  console.error("❌ CA polling error:", err);
});
