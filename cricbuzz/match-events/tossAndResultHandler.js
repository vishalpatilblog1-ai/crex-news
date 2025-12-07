// cricbuzz/tossAndResultHandler.js

import { postTweet_console, postTweet_web } from "../../twitter.js";
import { saveState } from "../../utils/stateStoreCloud.js";
import { buildMatchContext } from "../buildMatchContext.js";
import {
  buildMatchResultTweet,
  buildTossTweet,
} from "../templates/toss-and-result-default-template.js";

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

    if (!toss || STATE[`toss_${MATCH_ID}`] || matchStarted) return;

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

    const { match, event } = matchContext;
    const team1Short = matchContext?.match?.team1Short || "";
    const team2Short = matchContext?.match?.team2Short || "";
    const tossWinnerShortName = event?.tossWinnerShortName;
    const format = (match?.format || "").toUpperCase() || "";

    const tweet = buildTossTweet(
      match,
      event,
      team1Short,
      team2Short,
      tossWinnerShortName,
      format
    );

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
    if (!score?.ismatchcomplete || !score?.status) return;

    if (STATE[`result_${MATCH_ID}`]) return;

    STATE[`result_${MATCH_ID}`] = true;
    saveState(STATE);

    const resultText = score.status;

    const syntheticEvent = {
      type: "MATCH_RESULT",
      resultText,
    };

    const matchContext = buildMatchContext({
      comm,
      currInnings: null,
      event: syntheticEvent,
      isMatchComplete: true,
      firstInnings,
    });

    const { match, event } = matchContext;
    const team1Short = matchContext?.match?.team1Short || "";
    const team2Short = matchContext?.match?.team2Short || "";
    const format = (match?.format || "").toUpperCase() || "";

    const tweet = buildMatchResultTweet(
      team1Short,
      team2Short,
      format,
      resultText
    );

    await postTweet_console(tweet);
    if (USE_WEB_TWEET) await postTweet_web(tweet);

    console.log("🏆 Match result tweet sent!");
    console.log(`🛑 Stopping all polling for match ${MATCH_ID}`);
    process.exit(0);
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

  const second = card[1];
  const fullScoreMeta = {
    isMatchComplete: scoreRes.ismatchcomplete ?? false,
    status: scoreRes.status ?? "",
    appindex: scoreRes.appindex ?? {},
    responselastupdated: scoreRes.responselastupdated ?? null,
  };

  if (second) {
    const hasStarted =
      Number(second.overs) > 0 ||
      Number(second.runs) > 0 ||
      Number(second.wickets) > 0 ||
      Number(second.ballnbr) > 0;

    if (hasStarted) {
      second.scoreMeta = fullScoreMeta;
      return second;
    }
  }
  let currInn = card.reduce((a, b) => (a.ballnbr > b.ballnbr ? a : b));
  currInn.scoreMeta = fullScoreMeta;
  return currInn;
}

export function getCorrectTestInnings(scoreRes, liveId) {
  if (!scoreRes?.scorecard || scoreRes.scorecard.length === 0) {
    return null;
  }

  const fullScoreMeta = {
    isMatchComplete: scoreRes.ismatchcomplete ?? false,
    status: scoreRes.status ?? "",
    appindex: scoreRes.appindex ?? {},
    responselastupdated: scoreRes.responselastupdated ?? null,
  };

  const card = scoreRes.scorecard;
  if (liveId) {
    const exact = scoreRes.scorecard.find((inn) => inn.inningsid === liveId);
    if (exact) {
      exact.scoreMeta = fullScoreMeta;
      return exact;
    }
  }
  let currInn = scoreRes.scorecard.reduce((a, b) =>
    (a.ballnbr ?? 0) > (b.ballnbr ?? 0) ? a : b
  );
  currInn.scoreMeta = fullScoreMeta;
  return currInn;
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

export function splitCommentary(text) {
  const clean = text.replace(/\s+$/gm, "");
  const parts = clean.split(/\n+/);
  const commLine1 = parts[0] || "";
  const commLine2 = parts[1] || "";
  return { commLine1, commLine2 };
}
