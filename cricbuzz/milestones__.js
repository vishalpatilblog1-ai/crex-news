// milestones.js — batting + partnership + session detection

export function checkBattingMilestones(score) {
  try {
    if (!score?.scorecard || score.scorecard.length === 0) return null;

    const innings = score.scorecard.at(-1); // latest innings
    if (!innings?.batsman) return null;

    const striker = innings.batsman.find((b) => b.striker === true);
    if (!striker) return null;

    const runs = striker.runs;

    // Batsman milestones
    if (runs === 50) return { type: "BAT_50", player: striker.name, runs };
    if (runs === 100) return { type: "BAT_100", player: striker.name, runs };
    if (runs === 150) return { type: "BAT_150", player: striker.name, runs };
    if (runs === 200) return { type: "BAT_200", player: striker.name, runs };

    return null;
  } catch (e) {
    return null;
  }
}

export function checkPartnershipMilestones(score) {
  try {
    const inns = score.scorecard.at(-1);
    if (!inns?.partnership) return null;

    const runs = inns.partnership.runs;

    if (runs === 50) return { type: "PART_50", runs };
    if (runs === 100) return { type: "PART_100", runs };

    return null;
  } catch (e) {
    return null;
  }
}

export function checkSessionBreak(ball) {
  const txt = ball.commtxt?.toLowerCase() || "";

  if (txt.includes("drinks")) return { type: "DRINKS" };
  if (txt.includes("lunch")) return { type: "LUNCH" };
  if (txt.includes("tea")) return { type: "TEA" };
  if (txt.includes("stumps")) return { type: "STUMPS" };

  return null;
}
