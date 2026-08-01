// import dotenv from "dotenv";
// dotenv.config();
// import fetch from "node-fetch";

// const BIN_ID = process.env.JSONBIN_BIN_ID;
// const API_KEY = process.env.JSONBIN_API_KEY;

// const BASE_URL = "https://api.jsonbin.io/v3/b/";

// export async function loadState() {
//   try {
//     const res = await fetch(`${BASE_URL}${BIN_ID}/latest`, {
//       headers: {
//         "X-Master-Key": API_KEY,
//       },
//     });

//     if (!res.ok) {
//       console.log("⚠ JSONBin load failed:", res.status);
//       return {};
//     }

//     const json = await res.json();
//     return json.record || {};
//   } catch (err) {
//     console.log("⚠ JSONBin load error:", err);
//     return {};
//   }
// }

// export async function saveState(stateObj, reason = "no-reason-provided") {
//   console.log(`💾 Saving state to JSONBin | Reason: ${reason}`);
//   try {
//     const res = await fetch(`${BASE_URL}${BIN_ID}`, {
//       method: "PUT",
//       headers: {
//         "Content-Type": "application/json",
//         "X-Master-Key": API_KEY,
//       },
//       body: JSON.stringify(stateObj),
//     });

//     if (!res.ok) {
//       console.log("⚠ JSONBin save failed:", res.status);
//     } else {
//       console.log("💾 State saved to JSONBin successfully");
//     }
//   } catch (err) {
//     console.log("⚠ JSONBin save error:", err);
//   }
// }

// utils/stateStoreCloud.js

import fs from "fs/promises";
import path from "path";

// const STATE_FILE = process.env.STATE_FILE_PATH || "/data/state.json";

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
  console.log(`💾 Saving state to disk | Reason: ${reason}`);
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
