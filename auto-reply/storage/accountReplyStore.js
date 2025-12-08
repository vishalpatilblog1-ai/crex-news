// auto-reply/storage/accountReplyStore.js
import { getReplyLimits, saveReplyLimits } from "./jsonbin.js";

const KEY = "accountReplyCounts";

export async function getAccountReplyCounts() {
  const data = await getReplyLimits();
  return data[KEY] || {};
}

export async function saveAccountReplyCounts(updatedCounts) {
  const data = await getReplyLimits();
  data[KEY] = updatedCounts;
  await saveReplyLimits(data);
}
