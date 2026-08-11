// cricbuzz/cricbuzzFilters.js
// Deterministic, no-API-call gate. Runs in the polling loop BEFORE
// generation — a story that fails this never reaches classifyArticle,
// judgeNewsContext, or Claude/GPT generation.

const INDIA_KEYWORDS = ["india", "indian", "bcci", "team india", "men in blue"];

const IPL_KEYWORDS = ["ipl", "indian premier league"];

// IPL team names/short forms — useful because an IPL story often won't say
// "India" or "IPL" explicitly in the headline (e.g. "Kohli signs with RCB").
const IPL_TEAMS = [
  "csk",
  "chennai super kings",
  "mi",
  "mumbai indians",
  "rcb",
  "royal challengers",
  "kkr",
  "kolkata knight riders",
  "srh",
  "sunrisers hyderabad",
  "dc",
  "delhi capitals",
  "pbks",
  "punjab kings",
  "rr",
  "rajasthan royals",
  "gt",
  "gujarat titans",
  "lsg",
  "lucknow super giants",
];

function extractSearchableText(story) {
  const parts = [
    story?.hline,
    story?.intro,
    story?.context,
    story?.storyText,
  ].filter(Boolean);

  return parts.join(" ").toLowerCase();
}

export function isIndiaRelated(story) {
  if (!story) return false;

  const text = extractSearchableText(story);
  if (!text) return false;

  const matchesAny = (list) => list.some((kw) => text.includes(kw));

  return (
    matchesAny(INDIA_KEYWORDS) ||
    matchesAny(IPL_KEYWORDS) ||
    matchesAny(IPL_TEAMS)
  );
}
