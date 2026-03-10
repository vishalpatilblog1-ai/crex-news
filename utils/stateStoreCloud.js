import dotenv from "dotenv";
dotenv.config();
import fetch from "node-fetch";

const BIN_ID = process.env.JSONBIN_BIN_ID;
const API_KEY = process.env.JSONBIN_API_KEY;

const BASE_URL = "https://api.jsonbin.io/v3/b/";

export async function loadState() {
  try {
    const res = await fetch(`${BASE_URL}${BIN_ID}/latest`, {
      headers: {
        "X-Master-Key": API_KEY,
      },
    });

    if (!res.ok) {
      console.log("⚠ JSONBin load failed:", res.status);
      return {};
    }

    const json = await res.json();
    return json.record || {};
  } catch (err) {
    console.log("⚠ JSONBin load error:", err);
    return {};
  }
}

// export async function saveState(stateObj, reason = "no-reason-provided") {
//   console.log(`💾 Saving state to JSONBin | Reason: ${reason}`);

//   try {
//     // Deep clone state so we don't mutate the in-memory STATE
//     const stateToSave = JSON.parse(JSON.stringify(stateObj));

//     // Remove heavy fields from queue items before saving
//     if (stateToSave?.tweetQueue?.length) {
//       stateToSave.tweetQueue = stateToSave.tweetQueue.map((t) => {
//         const { _articleBody, ...rest } = t;
//         return rest;
//       });
//     }

//     const res = await fetch(`${BASE_URL}${BIN_ID}`, {
//       method: "PUT",
//       headers: {
//         "Content-Type": "application/json",
//         "X-Master-Key": API_KEY,
//       },
//       body: JSON.stringify(stateToSave),
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

export async function saveState(stateObj, reason = "no-reason-provided") {
  console.log(`💾 Saving state to JSONBin | Reason: ${reason}`);
  try {
    const res = await fetch(`${BASE_URL}${BIN_ID}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Master-Key": API_KEY,
      },
      body: JSON.stringify(stateObj),
    });

    if (!res.ok) {
      console.log("⚠ JSONBin save failed:", res.status);
    } else {
      console.log("💾 State saved to JSONBin successfully");
    }
  } catch (err) {
    console.log("⚠ JSONBin save error:", err);
  }
}
