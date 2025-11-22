// commentaryParser.js — Safe extraction of batsman/bowler from Cricbuzz commentary

export function extractDetailsFromCommentary(commentaryData, eventType) {
  if (!commentaryData || !commentaryData.commentary) return null;

  // Get 3 most recent commentary lines
  const lines = commentaryData.commentary.slice(0, 3);

  let selected = null;

  for (const item of lines) {
    const text = (item.comm || "").toLowerCase();

    if (text.includes("over") && !text.includes(" for ")) continue;
    if (text.includes("review")) continue;
    if (text.includes("drinks")) continue;
    if (text.includes("partnership")) continue;
    if (text.includes("runs needed")) continue;

    if (eventType === "FOUR" && text.includes(" four")) selected = item;
    if (eventType === "SIX" && text.includes(" six")) selected = item;
    if (eventType === "WICKET" && text.includes("out")) selected = item;

    if (selected) break;
  }

  if (!selected) return null;

  const text = selected.comm;

  const batsmanMatch = text.match(/^([A-Z][a-zA-Z]+)\s/);
  const batsman = batsmanMatch ? batsmanMatch[1] : null;

  const bowlerMatch =
    text.match(/b\s+([A-Z][a-zA-Z]+)/i) ||
    text.match(/off\s+([A-Z][a-zA-Z]+)/i) ||
    text.match(/from\s+([A-Z][a-zA-Z]+)/i) ||
    text.match(/against\s+([A-Z][a-zA-Z]+)/i);

  const bowler = bowlerMatch ? bowlerMatch[1] : null;

  const shotMatch = text.match(
    /(pulls|drives|cuts|flicks|edges|lofts|punches|slams|smashes|sweeps)/i
  );
  const shot = shotMatch ? shotMatch[1] : null;

  const dirMatch = text.match(
    /(through\s+[a-zA-Z]+|over\s+[a-zA-Z]+|past\s+[a-zA-Z]+|to\s+[a-zA-Z]+)/i
  );
  const direction = dirMatch ? dirMatch[0] : null;

  return {
    batsman,
    bowler,
    shot,
    direction,
    raw: text,
  };
}
