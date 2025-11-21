import "dotenv/config";
import fs from "node:fs/promises";
import { findTodayIndVsSaMatch, getMatchInfo } from "./cricketdata/index.js";
import generateTweet from "./ai.js"; // your existing file
import postTweet from "./twitter.js"; // your existing file

const POLL_INTERVAL_MS = 30_000; // 30 sec – adjust if you want faster

// Where we store last seen score so we don't tweet duplicates
const STATE_DIR = "./state";

async function ensureStateDir() {
  try {
    await fs.mkdir(STATE_DIR, { recursive: true });
  } catch {}
}

function parseOvers(oversStr) {
  // "39.1" -> { overs: 39, balls: 1 }
  if (!oversStr) return { overs: 0, balls: 0 };
  const [oStr, bStr] = String(oversStr).split(".");
  const overs = Number(oStr) || 0;
  const balls = Number(bStr) || 0;
  return { overs, balls };
}

function makeInningsKey(matchId, inningsName) {
  return `${matchId}_${inningsName.replace(/\s+/g, "_")}`;
}

async function loadInningsState(key) {
  try {
    const raw = await fs.readFile(`${STATE_DIR}/${key}.json`, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function saveInningsState(key, state) {
  await fs.writeFile(
    `${STATE_DIR}/${key}.json`,
    JSON.stringify(state),
    "utf-8"
  );
}

/**
 * Detect events (FOUR / SIX / WICKET) between previous and current score
 */
function detectEvents(prev, curr, match, battingTeam, bowlingTeam) {
  const events = [];
  if (!prev) return events;

  const runsDiff = curr.r - prev.r;
  const wktsDiff = curr.w - prev.w;

  // ----- WICKET (most important — detect ALWAYS) -----
  const wicketDetected =
    wktsDiff > 0 ||
    curr.w > prev.w ||
    (curr.commentary && /out|caught|bowled|lbw/i.test(curr.commentary));

  if (wicketDetected) {
    events.push({
      type: "WICKET",
      runsDiff,
      wktsDiff,
      match,
      battingTeam,
      bowlingTeam,
      current: curr,
      previous: prev,
    });
  }

  // ----- SIX -----
  const sixDetected =
    runsDiff === 6 ||
    runsDiff > 6 || // aggregated updates
    (curr.commentary && /\bsix\b/i.test(curr.commentary));

  if (sixDetected) {
    events.push({
      type: "SIX",
      runsDiff,
      wktsDiff,
      match,
      battingTeam,
      bowlingTeam,
      current: curr,
      previous: prev,
    });
  }

  // ----- FOUR -----
  const fourDetected =
    runsDiff === 4 ||
    (runsDiff >= 2 && runsDiff < 6) || // aggregated runs between polls
    (curr.commentary && /\bfour\b|\b4 runs\b/i.test(curr.commentary));

  if (fourDetected) {
    events.push({
      type: "FOUR",
      runsDiff,
      wktsDiff,
      match,
      battingTeam,
      bowlingTeam,
      current: curr,
      previous: prev,
    });
  }

  return events;
}

function detectEvents_(prev, curr, match, battingTeam, bowlingTeam) {
  const events = [];
  if (!prev) return events; // first poll, nothing to compare

  const runsDiff = curr.r - prev.r;
  const wktsDiff = curr.w - prev.w;

  // Wicket
  if (wktsDiff > 0) {
    events.push({
      type: "WICKET",
      runsDiff,
      wktsDiff,
      match,
      battingTeam,
      bowlingTeam,
      current: curr,
      previous: prev,
    });
  }

  // SIX (approximation – if at least 6 runs added since last poll)
  if (runsDiff >= 6) {
    events.push({
      type: "SIX",
      runsDiff,
      wktsDiff,
      match,
      battingTeam,
      bowlingTeam,
      current: curr,
      previous: prev,
    });
  } else if (runsDiff === 4) {
    // FOUR
    events.push({
      type: "FOUR",
      runsDiff,
      wktsDiff,
      match,
      battingTeam,
      bowlingTeam,
      current: curr,
      previous: prev,
    });
  }

  // You can also add milestones here (50, 100, 150, etc) later.

  return events;
}

/**
 * Convert event object into a simple summary string (fallback if AI fails)
 */

function buildFallbackTweet(event) {
  const { type, battingTeam, bowlingTeam, current } = event;
  const scoreStr = `${battingTeam} ${current.r}/${current.w} in ${current.o} overs`;

  let mainLine = "";
  let detailLine = "";
  const hashtags = "#INDvSA #Cricket";

  if (type === "WICKET") {
    mainLine = `⚡ WICKET! ${bowlingTeam} strike!`;
    detailLine = `${scoreStr}. Big moment in the match.`;
  } else if (type === "SIX") {
    mainLine = `💥 SIX! ${battingTeam} go big!`;
    detailLine = `${scoreStr}. Clean hitting!`;
  } else if (type === "FOUR") {
    mainLine = `🔥 FOUR! ${battingTeam} find the gap!`;
    detailLine = `${scoreStr}. Lovely timing!`;
  } else {
    mainLine = `${scoreStr}`;
    detailLine = ``;
  }

  return formatTweetRandomly(mainLine, detailLine, hashtags);
}

function buildFallbackTweet_(event) {
  const { type, match, battingTeam, bowlingTeam, current } = event;
  const scoreStr = `${current.r}/${current.w} in ${current.o} overs`;

  if (type === "WICKET") {
    return `⚡ WICKET! ${bowlingTeam} strike against ${battingTeam}. Score now ${scoreStr} in ${match.name}. #Cricket #INDvSA`;
  }
  if (type === "SIX") {
    return `💥 SIX! ${battingTeam} go big again. Score: ${scoreStr} in ${match.name}. #Cricket #INDvSA`;
  }
  if (type === "FOUR") {
    return `🔥 FOUR! ${battingTeam} find the gap. Score: ${scoreStr} in ${match.name}. #Cricket #INDvSA`;
  }

  return `${battingTeam} are ${scoreStr} in ${match.name}. #Cricket #INDvSA`;
}

async function handleEvent(event) {
  try {
    console.log(
      `🎯 Detected event: ${event.type}, runs+${event.runsDiff}, wkts+${event.wktsDiff}`
    );

    let tweetText;

    try {
      // We pass rich data to your AI so it can make a nice tweet
      tweetText = await generateTweet({
        type: event.type,
        matchName: event.match.name,
        venue: event.match.venue,
        matchType: event.match.matchType,
        battingTeam: event.battingTeam,
        bowlingTeam: event.bowlingTeam,
        score: `${event.current.r}/${event.current.w} (${event.current.o} ov)`,
        runsDiff: event.runsDiff,
        wktsDiff: event.wktsDiff,
      });
    } catch (aiErr) {
      console.error("⚠️ AI failed, using fallback tweet:", aiErr.message);
      tweetText = buildFallbackTweet(event);
    }

    if (!tweetText || typeof tweetText !== "string") {
      console.error("⚠️ Invalid tweet text, skipping.");
      return;
    }

    console.log("🟡 Tweet to post:");
    console.log(tweetText);

    const res = await postTweet(tweetText);
    console.log("🟢 Tweet posted:", res);
  } catch (err) {
    console.error("❌ Error handling event:", err);
  }
}

function formatTweetRandomly(mainLine, detailLine, hashtags) {
  const styles = [
    // Style 1 — Energetic multi-line
    `${mainLine}\n\n${detailLine}\n\n${hashtags}`,

    // Style 2 — Punchy
    `${mainLine}\n\n${detailLine}\n\n${hashtags}`,

    // Style 3 — Minimal clean
    `${mainLine}\n${detailLine}\n\n${hashtags}`,
  ];

  // Pick random style
  const idx = Math.floor(Math.random() * styles.length);
  return styles[idx];
}

/**
 * Main loop
 */
async function startLiveTracker() {
  await ensureStateDir();

  console.log("🏏 Starting live tracker for India vs South Africa…");

  let match = null;

  while (!match) {
    console.log("🔎 Looking for today's India vs South Africa match.....");
    try {
      match = await findTodayIndVsSaMatch();
    } catch (err) {
      console.error("❌ Error while searching match:", err.message);
    }

    if (!match) {
      console.log("⏳ Match not found yet. Will retry in 60s…");
      await new Promise((r) => setTimeout(r, 60_000));
    }
  }

  console.log("✅ Found match:", match.name, "id:", match.id);

  const matchId = match.id;

  let lastInningsStateKey = null;

  // Polling loop
  while (true) {
    try {
      const info = await getMatchInfo(matchId);

      if (!info || !info.score || !info.score.length) {
        console.log("📭 No score yet. Waiting…");
      } else {
        const inningsList = info.score;
        const currentInnings = inningsList[inningsList.length - 1]; // last innings = currently batting

        const { inning, r, w, o } = currentInnings;

        const [battingTeamNameRaw] = inning.split(" Inning");
        const battingTeam = battingTeamNameRaw;
        const bowlingTeam =
          info.teams.find((t) => t !== battingTeam) || "Opponent";

        const inningsKey = makeInningsKey(matchId, inning);
        const prevState = await loadInningsState(inningsKey);

        const currentState = { r, w, o };

        const events = detectEvents(
          prevState,
          currentState,
          info,
          battingTeam,
          bowlingTeam
        );

        for (const ev of events) {
          await handleEvent(ev);
        }

        await saveInningsState(inningsKey, currentState);
        lastInningsStateKey = inningsKey;

        console.log(
          `📊 ${battingTeam} are ${r}/${w} in ${o} overs (${inning}). Events this poll: ${events.length}`
        );

        if (info.matchEnded) {
          console.log("🏁 Match ended. Stopping tracker.");
          break;
        }
      }
    } catch (err) {
      console.error("❌ Error in poll loop:", err.message);
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

startLiveTracker().catch((err) => {
  console.error("❌ Fatal error in live tracker:", err);
});
