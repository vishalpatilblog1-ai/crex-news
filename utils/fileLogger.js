// utils/fileLogger.js
import fs from "fs";
import path from "path";

// Must live on the persistent volume (same one state.json uses), or logs
// get wiped on every Railway redeploy -- defeating the whole point of this.
// Locally, this just creates a "logs" folder next to your other files.
const LOG_DIR =
  process.env.LOG_DIR ||
  (process.env.RAILWAY_ENVIRONMENT ? "/data/logs" : "./logs");

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function getLogFilePath() {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return path.join(LOG_DIR, `${today}.log`);
}

function formatArgs(args) {
  return args
    .map((arg) => {
      if (typeof arg === "string") return arg;
      try {
        return JSON.stringify(arg, null, 2);
      } catch {
        return String(arg);
      }
    })
    .join(" ");
}

const originalConsole = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

function writeToFile(level, args) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${level}] ${formatArgs(args)}\n`;

  fs.appendFile(getLogFilePath(), line, (err) => {
    if (err) {
      // Use the ORIGINAL console.error here -- calling the patched
      // console.error would try to log-to-file again and could loop.
      originalConsole.error("⚠️ Failed to write log to file:", err.message);
    }
  });
}

console.log = (...args) => {
  originalConsole.log(...args);
  writeToFile("LOG", args);
};

console.warn = (...args) => {
  originalConsole.warn(...args);
  writeToFile("WARN", args);
};

console.error = (...args) => {
  originalConsole.error(...args);
  writeToFile("ERROR", args);
};
