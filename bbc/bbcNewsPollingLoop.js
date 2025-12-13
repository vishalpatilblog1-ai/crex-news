// src/news/bbc/loops/bbcNewsPollingLoop.js

import { runBBCNewsPipeline } from "./bbcNewsPipeline.js";

// import { runBBCNewsPipeline } from "../bbcNewsPipeline.js";

let isRunning = false;

export async function bbcNewsPollingLoop() {
  if (isRunning) {
    console.log("⏳ BBC news pipeline already running, skipping this tick");
    return;
  }

  isRunning = true;
  console.log("📰 BBC news polling tick started");

  try {
    await runBBCNewsPipeline();
  } catch (err) {
    console.error("❌ BBC news polling error:", err);
  } finally {
    isRunning = false;
    console.log("📰 BBC news polling tick finished");
  }
}
