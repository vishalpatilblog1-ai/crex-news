// src/news/bbc/bbcNewsRunner.js
import { runBBCNewsPipeline } from "./bbcNewsPipeline.js";

(async () => {
  try {
    console.log("🏏 BBC News pipeline started");
    await runBBCNewsPipeline();
    console.log("✅ BBC News pipeline finished");
  } catch (err) {
    console.error("❌ BBC News pipeline failed", err);
  }
})();
