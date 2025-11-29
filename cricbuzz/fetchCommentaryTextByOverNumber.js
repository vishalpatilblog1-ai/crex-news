export function fetchCommentaryTextByOverNumber(commObject, overNum) {
  if (!commObject?.comwrapper || !Array.isArray(commObject.comwrapper)) {
    return [];
  }

  const targetOver = Number(overNum);

  const allBalls = commObject.comwrapper
    .map((obj) => obj.commentary)
    .filter((c) => c && typeof c.overnum !== "undefined");

  const filtered = allBalls.filter((c) => Number(c.overnum) === targetOver);

  filtered.sort((a, b) => (a.ballnbr || 0) - (b.ballnbr || 0));

  return filtered.map((c) => c.commtxt);
}

export function getFinalEventText({ commentaryText, scoreEvent }) {
  if (commentaryText && commentaryText.length > 0) {
    return commentaryText.join(" ").trim(); // prefer commentary
  }

  if (scoreEvent?.type) {
    // Build fallback text from scorecard detection
    switch (scoreEvent.type) {
      case "SIX":
        return `${scoreEvent.batterName} smashes a HUGE SIX! 💥`;
      case "FOUR":
        return `${scoreEvent.batterName} cracks a boundary for FOUR! ✨`;
      case "WICKET":
        return `WICKET! ${scoreEvent.batterName} is OUT! ⚡`;
      case "PARTNERSHIP":
        return `Partnership reaches ${scoreEvent.runs} runs! 🤝`;
      default:
        return null;
    }
  }

  return null; // nothing available
}
