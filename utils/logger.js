// logger.js
import fs from "fs";
import path from "path";

const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_BACKUPS = 5;

function formatTS() {
  const now = new Date();
  return now.toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// rotate logs inside the chosen directory
function rotateLogs(filePath) {
  try {
    if (!fs.existsSync(filePath)) return;

    const stats = fs.statSync(filePath);
    if (stats.size < MAX_LOG_SIZE) return;

    const oldest = filePath + `.${MAX_BACKUPS}`;
    if (fs.existsSync(oldest)) fs.unlinkSync(oldest);

    for (let i = MAX_BACKUPS - 1; i >= 1; i--) {
      const src = filePath + `.${i}`;
      const dest = filePath + `.${i + 1}`;
      if (fs.existsSync(src)) fs.renameSync(src, dest);
    }

    fs.renameSync(filePath, filePath + ".1");
    fs.writeFileSync(filePath, "");
  } catch (err) {
    console.error("Log rotation error:", err);
  }
}

export function createLogger(type = "local") {
  // Detect Railway environment
  const isRailway = !!process.env.RAILWAY_ENVIRONMENT;

  const baseDir = isRailway ? "/tmp" : "logs";

  const filePath =
    type === "prod"
      ? path.join(baseDir, "prod.log")
      : path.join(baseDir, "local.log");

  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  return function log(msg, ts = false) {
    try {
      if (typeof msg === "object") {
        msg = JSON.stringify(msg, null, 2);
      }

      rotateLogs(filePath);

      const line = ts ? `[${formatTS()}] ${msg}` : msg;

      fs.appendFileSync(filePath, line + "\n");

      // also print to console
      // console.log(line);
    } catch (err) {
      console.error("Logging Error:", err);
    }
  };
}
