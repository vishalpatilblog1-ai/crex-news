let lastBall = null;

export function detectEvents(scoreData) {
  if (!scoreData?.scorecard?.balls) return null;

  const balls = scoreData.scorecard.balls;
  const latestBall = balls[balls.length - 1];

  if (!lastBall) {
    lastBall = latestBall;
    return null; // first run
  }

  // If new ball happened
  if (latestBall.ball_number !== lastBall.ball_number) {
    lastBall = latestBall;

    if (latestBall.event === "FOUR") return { type: "FOUR", data: latestBall };
    if (latestBall.event === "SIX") return { type: "SIX", data: latestBall };
    if (latestBall.event === "WICKET")
      return { type: "WICKET", data: latestBall };

    return { type: "BALL", data: latestBall };
  }

  return null;
}
