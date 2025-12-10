// server.js
import express from "express";
import fs from "fs";
import path from "path";
import { createLogger } from "./utils/logger.js";
import "./cricbuzz/index.js";

const app = express();
const PORT = process.env.PORT || 3000;

const log = createLogger("prod");

// This prints to log file and console
log("🚀 Server started", true);

// API to download prod logs (Railway or local)
app.get("/download-prod-log", (req, res) => {
  const isRailway = !!process.env.RAILWAY_ENVIRONMENT;
  const logPath = isRailway ? "/tmp/prod.log" : path.resolve("logs/prod.log");

  if (!fs.existsSync(logPath)) {
    return res.status(404).send("Log file not found");
  }

  res.download(logPath, "prod.log");
});

// health check
app.get("/", (req, res) => {
  res.send("Logging system active. Use /download-prod-log to download logs.");
});

// Start server
app.listen(PORT, () => {
  log(`Server running on port ${PORT}`, true);
  console.log(`Server running on ${PORT}`);
});
