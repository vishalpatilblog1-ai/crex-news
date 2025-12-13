import dotenv from "dotenv";
dotenv.config();
import fetch from "node-fetch";

const BIN_ID = process.env.JSONBIN_BIN_ID;
const API_KEY = process.env.JSONBIN_API_KEY;

const BASE_URL = "https://api.jsonbin.io/v3/b/";

const HEADERS = {
  "Content-Type": "application/json",
  "X-Master-Key": API_KEY,
};

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

export async function saveState(stateObj) {
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

export async function loadFullState() {
  const res = await fetch(`${BASE_URL}${BIN_ID}/latest`, {
    headers: { "X-Master-Key": API_KEY },
  });

  if (!res.ok) {
    console.log("⚠ JSONBin load failed:", res.status);
    return {};
  }

  const json = await res.json();
  return json.record || {};
}

export async function saveFullState(state) {
  const res = await fetch(`${BASE_URL}${BIN_ID}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Master-Key": API_KEY,
    },
    body: JSON.stringify(state),
  });

  if (!res.ok) {
    console.log("⚠ JSONBin save failed:", res.status);
  } else {
    console.log("💾 JSONBin updated");
  }
}

// export async function loadFullState() {
//   try {
//     const res = await fetch(`${BASE_URL}${BIN_ID}/latest`, {
//       headers: { "X-Master-Key": API_KEY },
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

// export async function saveFullState(state) {
//   try {
//     const res = await fetch(`${BASE_URL}${BIN_ID}`, {
//       method: "PUT",
//       headers: HEADERS,
//       body: JSON.stringify(state),
//     });

//     if (!res.ok) {
//       console.log("⚠ JSONBin save failed:", res.status);
//       return false;
//     }

//     console.log("💾 State saved to JSONBin");
//     return true;
//   } catch (err) {
//     console.log("⚠ JSONBin save error:", err);
//     return false;
//   }
// }
