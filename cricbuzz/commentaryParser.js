// cricbuzz/commentaryParser.js

export function extractDetailsFromCommentary(comm, eventType) {
  if (!comm || !Array.isArray(comm?.commentary)) {
    return {};
  }

  // Find the latest ball commentary entry
  const lastBall =
    comm.commentary.find(
      (c) => c?.commText && c?.event && c.event.toLowerCase().includes("ball")
    ) || comm.commentary[0];

  if (!lastBall || !lastBall.commText) return {};

  const text = lastBall.commText.toLowerCase();

  let bowlerFromCommentary = null;
  let batsmanFromCommentary = null;

  // -----------------------------
  // ✅ Extract bowler (MOST RELIABLE)
  // -----------------------------

  // Pattern 1: "... SIX ... off Kuldeep Yadav"
  {
    const m = text.match(/off ([a-zA-Z .'-]+)/i);
    if (m) {
      bowlerFromCommentary = fixName(m[1]);
    }
  }

  // Pattern 2: "bowled by Kuldeep Yadav"
  if (!bowlerFromCommentary) {
    const m = text.match(/bowled by ([a-zA-Z .'-]+)/i);
    if (m) {
      bowlerFromCommentary = fixName(m[1]);
    }
  }

  // Pattern 3: "short ball from Bumrah"
  if (!bowlerFromCommentary) {
    const m = text.match(/from ([a-zA-Z .'-]+)$/i);
    if (m) {
      bowlerFromCommentary = fixName(m[1]);
    }
  }

  // -----------------------------
  // Extract batsman (optional)
  // -----------------------------
  {
    const m = text.match(/([a-zA-Z .'-]+) hits/i);
    if (m) batsmanFromCommentary = fixName(m[1]);
  }

  return {
    bowlerFromCommentary,
    batsmanFromCommentary,
    raw: lastBall.commText,
  };
}

// -----------------------------
// Helper to clean names
// -----------------------------
function fixName(str) {
  if (!str) return null;
  return str
    .replace(/[^a-zA-Z .'-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}
