import fetch from "node-fetch";

const BIN_ID = process.env.JSONBIN_BIN_ID;
const API_KEY = process.env.JSONBIN_API_KEY;

const BASE_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;

export async function loadStateFromJSONBin() {
  try {
    const resp = await fetch(BASE_URL, {
      headers: {
        "X-Master-Key": API_KEY,
      },
    });

    const data = await resp.json();
    return data.record || {};
  } catch (err) {
    console.error("❌ Failed to load JSONBin:", err);
    return {};
  }
}

export async function saveStateToJSONBin(stateObj) {
  try {
    await fetch(BASE_URL, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Master-Key": API_KEY,
      },
      body: JSON.stringify(stateObj),
    });

    console.log("🟢 State saved to JSONBin!");
  } catch (err) {
    console.error("❌ Failed to save JSONBin:", err);
  }
}
