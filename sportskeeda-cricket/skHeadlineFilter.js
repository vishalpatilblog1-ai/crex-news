// sportskeeda-cricket/skHeadlineFilter.js

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
  /when and where/i,
  /preview$/i,
  /live score/i,
  /scorecard/i,
  /schedule/i,
  /points table/i,
  /In Pictures/i,
  /Pictures/i,
  /Watch/i,
];

export function isBlockedSKHeadline(title = "") {
  return BLOCKED_TITLE_PATTERNS.some((pattern) => pattern.test(title));
}
