// ai.js — FINAL SCORECARD-ONLY VERSION (Stable)
import dotenv from "dotenv";
import OpenAI from "openai";
import {
  ALLOWED_EVENTS,
  EVENT_TYPES,
  PARTNERSHIP_MILESTONE_RUNS,
} from "./utils/constants.js";
import { smartShortName } from "./utils/formatter.js";

dotenv.config();
globalThis.LAST_PARTNERSHIP_MILESTONE = 0;

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function generateHashtag(match) {
  const t1 = (match.team1Short || "").toUpperCase();
  const t2 = (match.team2Short || "").toUpperCase();

  if (!t1 || !t2) return "";

  // India special rule
  if (t1 === "IND" || t2 === "IND") {
    const other = t1 === "IND" ? t2 : t1;
    return `#INDvs${other} #INDv${other}`;
  }

  return `#${t1}vs${t2} #${t1}v${t2}`;
}

export async function generateHeadline(matchContext) {
  const event = matchContext?.event?.type || "";
  const batter = matchContext?.event?.batterName || "";
  const bowler = matchContext?.players?.bowler || "";

  // Find outdesc from scorecard
  const outDesc =
    matchContext?.event?.outdesc ||
    matchContext?.raw?.score?.scorecard?.[0]?.batsman?.find(
      (b) => b.id === matchContext?.event?.batterId
    )?.outdec ||
    "";

  const styleMode = Math.floor(Math.random() * 8);

  try {
    const prompt = `
Rewrite a short cricket headline.
Style = ${styleMode}

EVENT RULES:

1️⃣ SIX  
- "<batter> smashes a SIX"

2️⃣ FOUR  
- "<batter> cracks a FOUR"

3️⃣ WICKET  
- "<batter> OUT! <bowler> gets the wicket."
- If outdesc exists, briefly include it:
  Example: "Caught & bowled King"

4️⃣ BATSMAN_MILESTONE  
- "<batter> brings up a FIFTY!"
- If 100 → "TON for <batter>!"

5️⃣ PARTNERSHIP_MILESTONE  
- "<name1>-<name2> bring up 50-run stand!"

GENERAL RULES:
- No ball-by-ball text.
- No stats.
- No invented names.
- Use EXACT names from matchContext.
- Short, sharp, clean.
- Emojis allowed only if styleMode == 6.

EVENT: ${event}
BATTER: ${batter}
BOWLER: ${bowler}
OUTDESC: ${outDesc}

Output ONLY the headline.
`;

    const res = await client.chat.completions.create({
      model: "gpt-4.1",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6,
    });

    let headline = res.choices[0].message.content.trim();

    // Highlight for Indian matches
    const t1 = matchContext?.match?.team1?.toUpperCase() || "";
    const t2 = matchContext?.match?.team2?.toUpperCase() || "";
    const matchHasIndia = t1.includes("IND") || t2.includes("IND");

    if (matchHasIndia) {
      const battingTeam =
        matchContext?.innings?.batteamsname?.toUpperCase() || "";
      const indiaPositive =
        (event === "FOUR" || event === "SIX") && battingTeam === "IND";

      if (indiaPositive) {
        headline = headline.toUpperCase();
      }
    }

    return headline;
  } catch (err) {
    console.error("HEADLINE AI ERROR:", err);
    return "";
  }
}

export function buildMatchResultTweet(matchContext) {
  const match = matchContext?.match;
  if (!match?.isMatchComplete) return null;

  const t1 = match.team1Short || match.team1 || "";
  const t2 = match.team2Short || match.team2 || "";
  const status = match.status || "";

  const hashtag = `#${t1}vs${t2} #${t1}v${t2}`;

  return `
  🏆 Match Result 🏆
  
  ${status}
  
  ${hashtag}
    `.trim();
}

export default async function generateTweet(matchContext) {
  try {
    const currentMatchStatus = matchContext.match.status;
    const isMatchComplete = matchContext?.match?.isMatchComplete;

    if (isMatchComplete && currentMatchStatus) {
      const resultTweet = buildMatchResultTweet(matchContext);
      if (resultTweet) return resultTweet;
    }

    if (!matchContext?.event?.type) return "SKIP";

    const event = matchContext.event.type.toUpperCase();

    if (!ALLOWED_EVENTS.includes(event)) {
      console.log("⏩ SKIP — Not tweet-worthy:", event);
      return "SKIP";
    }

    const { innings, players, match } = matchContext;

    let isPartnershipMilestone = false;
    let p = null;

    if (event === EVENT_TYPES.PARTNERSHIP_UPDATED) {
      const p = matchContext.innings.partnership;

      if (!p || !p.totalRuns) {
        console.log("⏩ SKIP — No partnership object found");
        return "SKIP";
      }

      const base = PARTNERSHIP_MILESTONE_RUNS;
      const total = p.totalRuns;

      const currentMilestone = Math.floor(total / base) * base;

      if (
        currentMilestone > 0 &&
        currentMilestone > globalThis.LAST_PARTNERSHIP_MILESTONE
      ) {
        isPartnershipMilestone = true;
        globalThis.LAST_PARTNERSHIP_MILESTONE = currentMilestone;
      } else {
        console.log(
          `⏩ SKIP — No new milestone (total=${total}, last=${globalThis.LAST_PARTNERSHIP_MILESTONE})`
        );
        return "SKIP";
      }
    }

    const battingTeamShort = innings.batteamsname || innings.batteamname || "";

    const battingFullName = match.team1
      .toLowerCase()
      .includes(battingTeamShort.toLowerCase())
      ? match.team1
      : match.team2;

    const header = `🚨 ${match.team1Short} vs ${match.team2Short} ${match.format} Updates 🚨`;
    const headline = await generateHeadline(matchContext);

    const scoreLine = `${battingFullName} - ${innings.runs}/${innings.wickets} (${innings.overs} Overs)`;

    const strikerName = smartShortName(players.striker, players.nonStriker);
    const nonStrikerName = smartShortName(players.nonStriker, players.striker);

    const strikerLine =
      strikerName && players.strikerRuns && players.strikerBallsPlayed
        ? `${strikerName}: ${players.strikerRuns} (${players.strikerBallsPlayed})`
        : "";

    const nonStrikerLine =
      nonStrikerName && players.nonStrikerRuns && players.nonStrikerBallsPlayed
        ? `${nonStrikerName}: ${players.nonStrikerRuns} (${players.nonStrikerBallsPlayed})`
        : "";

    let parts = [];
    parts.push(header);
    parts.push("");

    // const base = PARTNERSHIP_MILESTONE_RUNS;
    // const nextMilestone = Math.floor(p.totalRuns / base) * base;
    if (isPartnershipMilestone) {
      const p = innings.partnership; // already normalized

      parts.push(`💯 ${p.totalRuns}-run Partnership!`);
      parts.push("");

      // Batter 1
      parts.push(`${p.bat1.name} ${p.bat1.runs}(${p.bat1.balls})`);

      // Batter 2
      parts.push(`${p.bat2.name} ${p.bat2.runs}(${p.bat2.balls})`);

      parts.push("");

      // Total partnership line
      parts.push(`Total: ${p.totalRuns}(${p.totalBalls})`);

      parts.push("");
      parts.push(scoreLine);
      parts.push("");
      parts.push(currentMatchStatus);
      parts.push("");
      parts.push(generateHashtag(match));

      return parts.join("\n").trim();
    }

    if (event === EVENT_TYPES.BATSMAN_MILESTONE) {
      const m = matchContext.event;

      let parts = [];
      parts.push(
        `🚨 ${match.team1Short} vs ${match.team2Short} ${match.format} Updates 🚨`
      );
      parts.push("");
      parts.push(`💯 Milestone for ${m.batterName}!`);
      parts.push(`${m.batterName} reaches ${m.runs}* off ${m.balls} balls 👏`);
      parts.push("");
      parts.push(
        `${battingFullName} - ${innings.runs}/${innings.wickets} (${innings.overs} Overs)`
      );
      parts.push("");
      parts.push(match.status);
      parts.push("");
      parts.push(generateHashtag(match));

      return parts.join("\n").trim();
    }

    if (event === EVENT_TYPES.BOWLER_MILESTONE) {
      const m = matchContext.event; // {bowlerName, wickets, runs, overs}

      const headline = `${m.bowlerName} completes a FIVE-WICKET HAUL! 🔥`;

      let parts = [];
      parts.push(
        `🚨 ${match.team1Short} vs ${match.team2Short} ${match.format} Updates 🚨`
      );
      parts.push("");
      parts.push(headline);
      parts.push("");
      parts.push(
        `${innings.batteamsname} - ${innings.runs}/${innings.wickets} (${innings.overs} Overs)`
      );
      parts.push("");
      parts.push(`${m.bowlerName}: ${m.wickets}/${m.runs} in ${m.overs} overs`);
      parts.push("");
      parts.push(match.status);
      parts.push("");
      parts.push(generateHashtag(match));

      return parts.join("\n").trim();
    }

    parts.push(headline);
    parts.push("");
    parts.push(scoreLine);
    parts.push("");

    if (event !== EVENT_TYPES.WICKET) {
      if (strikerLine) parts.push(strikerLine);
      if (nonStrikerLine) parts.push(nonStrikerLine);
      parts.push("");
    }

    while (parts.length && parts[parts.length - 1].trim() === "") {
      parts.pop();
    }

    parts.push("");
    parts.push(currentMatchStatus);
    parts.push("");
    parts.push(generateHashtag(match));

    return parts.join("\n").trim();
  } catch (err) {
    console.error("AI ERROR:", err);
    return "SKIP";
  }
}
