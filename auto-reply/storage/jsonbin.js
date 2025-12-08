// storage/jsonbin.js
import dotenv from "dotenv";
dotenv.config();
import fetch from "node-fetch";

const REPLIED_TWEETS_URL = process.env.JSONBIN_REPLIED_TWEETS_URL;
const REPLY_LIMITS_URL = process.env.JSONBIN_REPLY_LIMITS_URL;
const API_KEY = process.env.JSONBIN_API_KEY;

if (!REPLIED_TWEETS_URL) {
  console.log("❌ Missing JSONBIN_REPLIED_TWEETS_URL in .env");
}
if (!REPLY_LIMITS_URL) {
  console.log("❌ Missing JSONBIN_REPLY_LIMITS_URL in .env");
}
if (!API_KEY) {
  console.log("❌ Missing JSONBIN_API_KEY in .env");
}

// Generic function for GET
async function jsonbinGet(url) {
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "X-Master-Key": API_KEY,
      },
    });

    const json = await res.json();
    return json.record || json;
  } catch (err) {
    console.log("❌ JSONBin GET Error:", err);
    return null;
  }
}

// Generic function for PUT
async function jsonbinPut(url, data) {
  try {
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Master-Key": API_KEY,
      },
      body: JSON.stringify(data),
    });

    const json = await res.json();
    return json.record || json;
  } catch (err) {
    console.log("❌ JSONBin PUT Error:", err);
    return null;
  }
}

// Export the two dedicated APIs
export async function getRepliedTweets() {
  return jsonbinGet(REPLIED_TWEETS_URL);
}

export async function saveRepliedTweets(data) {
  return jsonbinPut(REPLIED_TWEETS_URL, data);
}

export async function getReplyLimits() {
  return jsonbinGet(REPLY_LIMITS_URL);
}

export async function saveReplyLimits(data) {
  return jsonbinPut(REPLY_LIMITS_URL, data);
}
