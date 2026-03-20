// getUserIds.js
import { twitterClient } from "../twitter/twitter.js";

export async function getUserIds(usernames = []) {
  try {
    if (!Array.isArray(usernames) || usernames.length === 0) {
      console.log("⚠️ No usernames provided");
      return {};
    }

    const client = twitterClient.readOnly;

    const res = await client.v2.usersByUsernames(usernames);

    const users = res?.data || [];

    const map = {};
    users.forEach((user) => {
      map[user.username] = user.id;
    });

    console.log("✅ User IDs fetched:", map);

    return map;
  } catch (err) {
    console.error("❌ Error fetching user IDs:", err?.message || err);
    return {};
  }
}
