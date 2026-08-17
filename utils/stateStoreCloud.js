import fs from "fs/promises";
import path from "path";

const STATE_FILE =
  process.env.STATE_FILE_PATH || path.join(process.cwd(), "data", "state.json");

export async function loadState() {
  try {
    const raw = await fs.readFile(STATE_FILE, "utf-8");
    return JSON.parse(raw) || {};
  } catch (err) {
    if (err.code === "ENOENT") {
      console.log("ℹ️ No state file yet — starting fresh");
      return {};
    }
    console.log("⚠️ State load error:", err);
    return {};
  }
}

export async function saveState(stateObj, reason = "no-reason-provided") {
  // console.log(`💾 Saving state to disk | Reason: ${reason}`);
  try {
    await fs.mkdir(path.dirname(STATE_FILE), { recursive: true });
    const tmpFile = `${STATE_FILE}.tmp`;
    await fs.writeFile(tmpFile, JSON.stringify(stateObj), "utf-8");
    await fs.rename(tmpFile, STATE_FILE); // atomic swap, avoids corrupt file if crash mid-write
    console.log("✅ State saved to disk");
  } catch (err) {
    console.log("⚠️ State save error:", err);
  }
}
