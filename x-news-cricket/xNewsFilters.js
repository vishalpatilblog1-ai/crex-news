// x-news-cricket/xNewsFilters.js
//
// Filters for X News API story candidates. Two jobs:
// 1. Reject non-cricket noise (the endpoint's `query=cricket` free-text
//    search isn't a strict filter — e.g. a "name a ball sport" riddle post
//    surfaced in early testing despite matching the keyword).
// 2. Reject low-value patterns, mirrored from skHeadlineFilter.js.

const BLOCKED_TITLE_PATTERNS = [
  /playing xi/i,
  /probable xi/i,
  /match prediction/i,
  /who will win/i,
  /dream11/i,
  /fantasy/i,
  /pitch report/i,
  /weather report/i,
  /head[- ]to[- ]head/i,
  /how to watch/i,
  /where to watch/i,
  /live streaming/i,
  /live telecast/i,
  /streaming details/i,
  /schedule/i,
  /points table/i,
];

// Real cricket stories should trip at least one of these — either the
// dedicated sports.teams context, the topics array saying "Cricket", or a
// cricket term appearing in the headline/hook/summary itself. This catches
// cases like the riddle post where topics=["Sports"] with no cricket signal.
const CRICKET_SIGNAL_PATTERN =
  /cricket|IPL|T20|ODI|Test match|BCCI|wicket|batsman|bowler|all-rounder|innings/i;

export function isBlockedXNewsHeadline(headline = "") {
  return BLOCKED_TITLE_PATTERNS.some((pattern) => pattern.test(headline));
}

export function isCricketStory(story) {
  if (!story) return false;

  const topicsSayCricket = (story.topics || []).some(
    (topic) => topic.toLowerCase() === "cricket",
  );
  if (topicsSayCricket) return true;

  if ((story.teams || []).length > 0) {
    // A populated sports.teams array on a "Sports" topic story is a decent
    // signal, but confirm with a text check too since teams could in theory
    // belong to another sport in mixed clusters.
    const textBlob = `${story.headline} ${story.hook} ${story.summary}`;
    if (CRICKET_SIGNAL_PATTERN.test(textBlob)) return true;
  }

  const textBlob = `${story.headline} ${story.hook} ${story.summary}`;
  return CRICKET_SIGNAL_PATTERN.test(textBlob);
}
