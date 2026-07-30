// cricket-addictor/caHeadlineFilter.js

const BLOCKED_TITLE_PATTERNS = [
  /playing xi/i,
  /probable xi/i,
  /match prediction/i,
  /who will win/i,
  /preview/i,
  /pitch/i,
  /weather/i,
  /head[- ]to[- ]head/i,
  /fantasy/i,
  /best batter/i,
  /best bowler/i,
  /how to watch/i,
  /where to watch/i,
  /live streaming/i,
  /live telecast/i,
  /telecast/i,
  /streaming details/i,
  /when and where/i,
  /dream11/i,
];

export function isBlockedCAHeadline(title = "") {
  return BLOCKED_TITLE_PATTERNS.some((re) => re.test(title));
}
