// cricbuzz/handlers/handleTossEvent.js

import { postTweet_console, postTweet_web } from "../../twitter.js";
import { saveState } from "../../utils/stateStore.js";
import { buildMatchContext } from "../buildMatchContext.js";
import { buildTemplateTweet } from "../templateEngine.js";

export async function handleTossEvent({
  comm,
  score,
  toss,
  MATCH_ID,
  STATE,
  USE_WEB_TWEET,
}) {
  try {
    const ballNbrFromMini = comm?.miniscore?.ballnbr ?? null;
    const inningsFromScore = score?.scorecard?.[0]?.ballnbr ?? null;

    const matchStarted =
      (ballNbrFromMini !== null && ballNbrFromMini > 0) ||
      (inningsFromScore !== null && inningsFromScore > 0);

    // Skip if toss already tweeted or match already started
    if (!toss || STATE[`toss_${MATCH_ID}`] || matchStarted) return;

    // Mark toss as tweeted
    STATE[`toss_${MATCH_ID}`] = true;
    saveState(STATE);

    const syntheticEvent = {
      type: "TOSS",
      ...toss,
    };

    const matchContext = buildMatchContext({
      comm,
      currInnings: null,
      event: syntheticEvent,
      isMatchComplete: false,
      firstInnings: null,
    });

    const tweet = await buildTemplateTweet(matchContext);

    if (!tweet || tweet === "SKIP") {
      console.log("⏭️ Toss not ready yet. Skipping...");
      return;
    }

    await postTweet_console(tweet);
    if (USE_WEB_TWEET) await postTweet_web(tweet);

    console.log(`🪙 Toss tweet sent! -> ${toss.tossText}`);
  } catch (err) {
    console.log("⚠ Toss handler error:", err);
  }
}

export async function handleMatchResultEvent({
  comm,
  score,
  STATE,
  MATCH_ID,
  USE_WEB_TWEET,
  firstInnings,
}) {
  try {
    // No match result? Skip.
    if (!score?.ismatchcomplete || !score?.status) return;

    // Already tweeted? Skip.
    if (STATE[`result_${MATCH_ID}`]) return;

    // Mark result as tweeted.
    STATE[`result_${MATCH_ID}`] = true;
    saveState(STATE);

    const syntheticEvent = {
      type: "MATCH_RESULT",
      resultText: score.status,
    };

    // Build match context using the same function used everywhere
    const matchContext = buildMatchContext({
      comm,
      currInnings: null,
      event: syntheticEvent,
      isMatchComplete: true,
      firstInnings,
    });

    const tweet = await buildTemplateTweet(matchContext);

    if (tweet) {
      await postTweet_console(tweet);
      if (USE_WEB_TWEET) await postTweet_web(tweet);
    }

    console.log("🏆 Match result tweet sent!");
  } catch (err) {
    console.log("⚠ Match result handler error:", err);
  }
}

export function extractTossInfo(comm) {
  const t = comm?.matchheaders?.tossresults;
  if (!t) return null;

  return {
    tossWinner: t.tosswinnername || "",
    tossDecision: (t.decision || "").toLowerCase(), // batting / bowling
    tossText: `${
      t.tosswinnername
    } won the toss and chose to ${t.decision.toLowerCase()}`,
  };
}

export function getCorrectInnings(scoreRes) {
  const card = scoreRes?.scorecard;
  if (!card || card.length === 0) return null;

  const first = card[0];
  const second = card[1];

  // 1️⃣ If 2nd innings exists and has ANY activity → choose it
  if (second) {
    const hasStarted =
      Number(second.overs) > 0 ||
      Number(second.runs) > 0 ||
      Number(second.wickets) > 0 ||
      Number(second.ballnbr) > 0;

    if (hasStarted) return second;
  }

  // 2️⃣ Else pick the innings with highest ballnbr
  return card.reduce((a, b) => (a.ballnbr > b.ballnbr ? a : b));
}

export function getCorrectTestInnings(scoreRes, liveId) {
  if (!scoreRes?.scorecard || scoreRes.scorecard.length === 0) {
    return null; // MATCH NOT STARTED
  }

  const card = scoreRes.scorecard;
  if (liveId) {
    const exact = scoreRes.scorecard.find((inn) => inn.inningsid === liveId);
    if (exact) return exact;
  }

  return scoreRes.scorecard.reduce((a, b) =>
    (a.ballnbr ?? 0) > (b.ballnbr ?? 0) ? a : b
  );
}

export function getFirstInnings(scoreRes) {
  if (!scoreRes?.scorecard || scoreRes.scorecard.length === 0) {
    return null;
  }
  const firstInning = scoreRes?.scorecard[0];
  return {
    targetRuns: firstInning.score,
    targetWicket: firstInning.wickets,
    targetOvers: firstInning.overs,
    battingTeamName: firstInning.batteamname,
    battingTeamShortName: firstInning.batteamsname,
  };
}
