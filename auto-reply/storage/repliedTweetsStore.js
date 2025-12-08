// storage/repliedTweetsStore.js
import dotenv from "dotenv";
dotenv.config();
import fetch from "node-fetch";
import { createLogger } from "../../utils/logger.js";
// import { createLogger } from "../utils/logger.js";

const log = createLogger("replied-tweets-store");

// JSONBIN_REPLIED_TWEETS_URL = "https://api.jsonbin.io/v3/b/YYYY"
const JSONBIN_REPLIED_TWEETS_URL = process.env.JSONBIN_REPLIED_TWEETS_URL;
const JSONBIN_API_KEY = process.env.JSONBIN_API_KEY;

if (!JSONBIN_REPLIED_TWEETS_URL) {
  console.log(
    "JSONBIN_REPLIED_TWEETS_URL not set. Replied tweets will not persist."
  );
}

export async function getRepliedTweets() {
  if (!JSONBIN_REPLIED_TWEETS_URL || !JSONBIN_API_KEY) {
    return [];
  }

  try {
    const res = await fetch(JSONBIN_REPLIED_TWEETS_URL, {
      method: "GET",
      headers: {
        "X-Master-Key": JSONBIN_API_KEY,
      },
    });

    if (!res.ok) {
      console.log(
        "Failed to fetch replied tweets from JSONBin:",
        res.statusText
      );
      return [];
    }

    const data = await res.json();
    return data.record || data || [];
  } catch (err) {
    console.log("Error fetching replied tweets from JSONBin:", err);
    return [];
  }
}

export async function saveRepliedTweets(idsArray) {
  if (!JSONBIN_REPLIED_TWEETS_URL || !JSONBIN_API_KEY) {
    console.log("Replied tweets not saved because JSONBin config is missing.");
    return;
  }

  try {
    const res = await fetch(JSONBIN_REPLIED_TWEETS_URL, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Master-Key": JSONBIN_API_KEY,
      },
      body: JSON.stringify(idsArray),
    });

    if (!res.ok) {
      console.log("Failed to save replied tweets to JSONBin:", res.statusText);
    }
  } catch (err) {
    console.log("Error saving replied tweets to JSONBin:", err);
  }
}
