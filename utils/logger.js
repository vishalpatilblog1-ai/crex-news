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

function rotateLogs(filePath) {
  try {
    if (!fs.existsSync(filePath)) return;

    const stats = fs.statSync(filePath);
    if (stats.size < MAX_LOG_SIZE) return;

    const oldest = filePath + `.${MAX_BACKUPS}`;
    if (fs.existsSync(oldest)) {
      fs.unlinkSync(oldest);
    }

    for (let i = MAX_BACKUPS - 1; i >= 1; i--) {
      const src = filePath + `.${i}`;
      const dest = filePath + `.${i + 1}`;
      if (fs.existsSync(src)) {
        fs.renameSync(src, dest);
      }
    }

    fs.renameSync(filePath, filePath + ".1");

    fs.writeFileSync(filePath, "");
  } catch (err) {}
}

export function createLogger(type = "local") {
  const filePath =
    type === "prod"
      ? path.resolve("logs/prod.log")
      : path.resolve("logs/local.log");

  // fs.mkdirSync("logs", { recursive: true });
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  return function log(msg, ts = false) {
    if (typeof msg === "object") {
      msg = JSON.stringify(msg, null, 2);
    }

    rotateLogs(filePath);

    const line = ts ? `[${formatTS()}] ${msg}` : msg;

    fs.appendFileSync(filePath, line + "\n");
  };
}
