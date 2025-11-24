export function extractDetailsFromCommentary(comm, eventType) {
  if (!comm || !Array.isArray(comm?.comwrapper)) {
    return {};
  }

  // Flatten commentary
  const all = comm.comwrapper
    .flatMap((w) => w.commentary || [])
    .filter((c) => c?.commText);

  if (all.length === 0) return {};

  // Pick latest ball commentary
  const lastBall =
    all.find((c) => c.event && c.event.toLowerCase().includes("ball")) ||
    all[0];

  const text = lastBall.commText.toLowerCase();
  const raw = lastBall.commText;

  let bowlerFromCommentary = null;
  let batsmanFromCommentary = null;

  let m;

  // -----------------------------
  // BOWLER EXTRACTION
  // -----------------------------

  // 1) “12.4 Bumrah to Bavuma”
  m = raw.match(/^\s*\d+\.\d+\s*[:.]?\s*([A-Za-z .'-]+)\s+to\s+/i);
  if (m) bowlerFromCommentary = fixName(m[1]);

  // 2) “Bumrah to Bavuma”
  if (!bowlerFromCommentary) {
    m = raw.match(/^\s*([A-Za-z .'-]+)\s+to\s+/i);
    if (m) bowlerFromCommentary = fixName(m[1]);
  }

  // 3) “off Rabada” (FOUR! off Rabada)
  if (!bowlerFromCommentary) {
    m = text.match(/off\s+([a-zA-Z .'-]+)$/i);
    if (m) bowlerFromCommentary = fixName(m[1]);
  }

  // 4) “from Nortje” (short ball from Nortje)
  if (!bowlerFromCommentary) {
    m = text.match(/from\s+([a-zA-Z .'-]+)$/i);
    if (m) bowlerFromCommentary = fixName(m[1]);
  }

  // -----------------------------
  // BATSMAN EXTRACTION
  // -----------------------------
  // “Rahul hits…”
  m = text.match(/([a-zA-Z .'-]+)\s+hits/i);
  if (m) batsmanFromCommentary = fixName(m[1]);

  // “to Bavuma” (from line “Bumrah to Bavuma”)
  if (!batsmanFromCommentary) {
    m = raw.match(/to\s+([A-Za-z .'-]+)/i);
    if (m) batsmanFromCommentary = fixName(m[1]);
  }

  return {
    bowlerFromCommentary,
    batsmanFromCommentary,
    raw,
  };
}

export function fixName(str) {
  if (!str) return null;
  return str
    .replace(/[^a-zA-Z .'-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}
