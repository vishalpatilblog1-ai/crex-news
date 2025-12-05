// tweetQuality.js

export function isHighQualityTweet(text) {
  const t = text.toLowerCase();

  // PRIORITY 1 — Big match events
  if (
    t.includes("six") ||
    t.includes("wicket") ||
    t.includes("dismiss") ||
    t.includes("catch")
  )
    return true;

  // PRIORITY 2 — Big names
  if (
    ["kohli", "virat", "rohit", "hardik", "bumrah", "jadeja", "ruturaj"].some(
      (n) => t.includes(n)
    )
  )
    return true;

  // PRIORITY 3 — Toss, match start updates
  if (t.includes("won the toss")) return true;

  // PRIORITY 4 — Milestones
  if (
    t.includes("fifty") ||
    t.includes("hundred") ||
    t.includes("century") ||
    t.includes("partnership")
  )
    return true;

  // PRIORITY 5 — Emotion / viral potential
  if (t.includes("emotional") || t.includes("kids") || t.includes("fans"))
    return true;

  // Reject boring posts
  if (t.length < 8) return false;

  // Reject extremely generic posts
  if (["good morning", "hello", "breaking"].some((p) => t.includes(p)))
    return false;

  return false;
}
