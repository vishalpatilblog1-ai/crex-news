// dedupe.js

import { loadFullState, saveFullState } from "../utils/stateStoreCloud.js";

const BBC_KEY = "bbc_news";

// if a run crashes after locking, allow retry after TTL
const BBC_LOCK_TTL_MS = 15 * 60 * 1000; // 15 minutes

let cache = null;

async function getState() {
  if (!cache) {
    cache = await loadFullState();
    if (!cache || typeof cache !== "object") cache = {};
    if (!cache[BBC_KEY]) cache[BBC_KEY] = {};
  }
  return cache;
}

function nowIso() {
  return new Date().toISOString();
}

function isExpiredLock(entry) {
  if (!entry) return false;
  if (entry.status !== "locked") return false;
  if (!entry.lockedAt) return true;

  const lockedAtMs = Date.parse(entry.lockedAt);
  if (Number.isNaN(lockedAtMs)) return true;

  return Date.now() - lockedAtMs > BBC_LOCK_TTL_MS;
}

export async function isDuplicateBBC(guid) {
  const state = await getState();
  const entry = state[BBC_KEY][guid];

  if (!entry) return false;

  if (entry.status === "posted") return true;

  if (entry.status === "locked") {
    return !isExpiredLock(entry);
  }

  if (entry.postedAt) return true;

  return false;
}

export async function lockPosting(guid) {
  const state = await getState();

  const existing = state[BBC_KEY][guid];
  if (existing?.status === "posted") return false;
  if (existing?.status === "locked" && !isExpiredLock(existing)) return false;

  state[BBC_KEY][guid] = {
    status: "locked",
    lockedAt: nowIso(),
    source: "bbc",
  };

  await saveFullState(state);
  return true; // 🔥 THIS WAS MISSING
}

// export async function lockPosting(guid) {
//   const state = await getState();
//   const existing = state[BBC_KEY][guid];

//   if (existing?.status === "posted") return false;
//   if (existing?.status === "locked" && !isExpiredLock(existing)) return false;

//   state[BBC_KEY][guid] = {
//     status: "locked",
//     lockedAt: nowIso(),
//     source: "bbc",
//   };

//   await saveFullState(state);
//   return true; // ✅ IMPORTANT
// }

// export async function lockPosting(guid) {
//   const state = await getState();

//   const existing = state[BBC_KEY][guid];
//   if (existing && existing.status === "posted") return;
//   if (existing && existing.status === "locked" && !isExpiredLock(existing))
//     return;

//   state[BBC_KEY][guid] = {
//     status: "locked",
//     lockedAt: nowIso(),
//     source: "bbc",
//   };

//   await saveFullState(state);
// }

/**
 * Finalize after tweet is actually posted.
 */
export async function markBBCPosted(guid, tweetId) {
  const state = await getState();

  state[BBC_KEY][guid] = {
    status: "posted",
    postedAt: nowIso(),
    source: "bbc",
    ...(tweetId ? { tweetId } : {}),
  };

  await saveFullState(state);
}

/**
 * Optional: call this only if you want retry on failure.
 * If you prefer "never retry", you can skip unlock and keep lock.
 */
export async function unlockPosting(guid) {
  const state = await getState();
  const entry = state[BBC_KEY][guid];

  if (entry?.status === "locked") {
    delete state[BBC_KEY][guid];
    await saveFullState(state);
  }
}
