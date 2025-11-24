import OpenAI from "openai";
import dotenv from "dotenv";
import { cleanBallText, shortTeamName } from "./utils/formatter.js";

dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ----------------------------------------------
// AI HEADLINE GENERATOR
// ----------------------------------------------
export async function generateHeadline(ballText) {
  try {
    const prompt = `
Rewrite the cricket ball commentary into a clean, human-style headline.
Keep it short, natural, and cricket-specific.

STRICT RULES:
- Do NOT add scores, strike rates, or stats.
- Do NOT guess or add new player names.
- Use ONLY the players already present in the text.
- If the action described is POSITIVE for India (India batter hits FOUR/SIX, or India bowler gets wicket),
  then add ONE emoji at the end (for six - 💥, for four - 🔥, for wicket - 📛).
- If it's NOT positive for India, add NO emoji.
- Do NOT add analysis.

Ball Text:
"${ballText}"

Output ONLY the rewritten headline.
`;

    const res = await client.chat.completions.create({
      model: "gpt-4.1",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
    });

    return res.choices[0].message.content.trim();
  } catch (err) {
    console.error("HEADLINE AI ERROR:", err);
    return "";
  }
}

// ----------------------------------------------
// MAIN TWEET GENERATOR
// ----------------------------------------------
export default async function generateTweet(ctx) {
  try {
    if (!ctx?.ball?.eventtype) return "SKIP";

    const event = ctx.ball.eventtype.toUpperCase();
    const cleanText = cleanBallText(ctx.ball.text);

    const { innings, players, match } = ctx;
    const currentPartnership = innings?.currentPartnership;

    // Partnership crossing logic
    const prevP = globalThis.LAST_PARTNERSHIP_RUNS || 0;
    const currP = currentPartnership?.totalRuns || 0;

    // Skip "NONE" or "over-break" unless milestone
    // if (!milestoneCrossed && !batterMilestoneHit) {
    if (event === "NONE") return "SKIP";
    if (event === "OVER-BREAK" || event === "over-break") return "SKIP";
    // }

    if (!cleanText || cleanText.length < 5) return "SKIP";

    const battingFullName = match.team1
      .toLowerCase()
      .includes(innings.battingTeam.toLowerCase())
      ? match.team1
      : match.team2;

    // ----------------------------------------------
    // START BUILDING TWEET PARTS
    // ----------------------------------------------
    let parts = [];

    const header = `🚨 ${shortTeamName(match.team1)} vs ${shortTeamName(
      match.team2
    )} ${match.format} Updates 🚨`;

    const headline = await generateHeadline(cleanText);

    const scoreLine = `${battingFullName} - ${innings.runs}/${innings.wickets} (${innings.overs} Overs)`;
    const strikerLine =
      players.striker && players.strikerRuns
        ? `${players.striker}: ${players.strikerRuns} (${players.strikerBallsPlayed})`
        : "";

    const nonStrikerLine =
      players.nonStriker && players.nonStrikerRuns
        ? `${players.nonStriker}: ${players.nonStrikerRuns} (${players.nonStrikerBallsPlayed})`
        : "";

    parts.push(header);
    parts.push("");
    parts.push(headline);
    parts.push("");
    parts.push(scoreLine);
    parts.push("");
    if (strikerLine) parts.push(strikerLine);
    if (nonStrikerLine) parts.push(nonStrikerLine);
    parts.push("");
    if (innings.trailOrLeadText) parts.push(innings.trailOrLeadText);

    // ----------------------------------------------
    // UPDATE MEMORY
    // ----------------------------------------------
    globalThis.LAST_PARTNERSHIP_RUNS = currP;

    return parts.join("\n").trim();
  } catch (err) {
    console.error("AI ERROR:", err);
    return "SKIP";
  }
}
