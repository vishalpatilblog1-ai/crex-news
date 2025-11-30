// aiCommentaryTweet.js
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateCommentaryTweet(
  event,
  rawCommentary,
  team1Short,
  team2Short
) {
  if (!event?.type) return "";

  // EVENT FLAGS
  const eventType = event.type;
  const isTeamMilestone = eventType === "TEAM_MILESTONE";
  const isBatsmanMilestone = eventType === "BATSMAN_MILESTONE";
  const isPartnershipMilestone = eventType === "PARTNERSHIP_MILESTONE";

  // Extract milestone data
  let bat1 = "";
  let bat2 = "";
  let milestone = event?.milestone || "";
  let finalRuns = "";
  let finalBalls = "";

  if (isTeamMilestone) {
    finalRuns = event?.runs || "";
    finalBalls = event?.balls || "";
  }

  if (isBatsmanMilestone) {
    const p = event?.partnership;

    if (p?.bat1?.name === event?.batterName) {
      bat1 = p.bat1.name;
      finalRuns = p.bat1.runs;
      finalBalls = p.bat1.balls;
    } else if (p?.bat2?.name === event?.batterName) {
      bat1 = p.bat2.name;
      finalRuns = p.bat2.runs;
      finalBalls = p.bat2.balls;
    } else {
      bat1 = event?.batterName || "";
      finalRuns = event?.runs || "";
      finalBalls = event?.balls || "";
    }
  }

  if (isPartnershipMilestone) {
    bat1 = event?.partnership?.bat1?.name || "";
    bat2 = event?.partnership?.bat2?.name || "";
    finalRuns = event?.partnership?.totalRuns || "";
    finalBalls = event?.partnership?.totalBalls || "";
  }

  const battingTeam = event?.batteamsname || "";
  const fielder = event?.fielderName || ""; // NEW

  // Sanitize commentary
  const cleanCommentary = (rawCommentary || "").replace(/\s+/g, " ").trim();

  // FINAL PRODUCTION PROMPT
  const prompt = `
You are a cricket AI that converts raw Cricbuzz commentary into a short, crisp, emotional, human Twitter update.

=====================================================
EVENT DETAILS (STRICT — DO NOT GUESS)
=====================================================
eventType: ${eventType}
milestone: ${milestone}
batterName: ${event.batterName || ""}
bowlerName: ${event.bowlerName || ""}
fielder: ${fielder}
battingTeam: ${battingTeam}

teamMilestoneRuns: ${isTeamMilestone ? finalRuns : ""}
teamMilestoneBalls: ${isTeamMilestone ? finalBalls : ""}

milestoneBatter: ${isBatsmanMilestone ? bat1 : ""}
batsmanMilestoneRuns: ${isBatsmanMilestone ? finalRuns : ""}
batsmanMilestoneBalls: ${isBatsmanMilestone ? finalBalls : ""}

partnershipBat1: ${isPartnershipMilestone ? bat1 : ""}
partnershipBat2: ${isPartnershipMilestone ? bat2 : ""}
partnershipRuns: ${isPartnershipMilestone ? finalRuns : ""}
partnershipBalls: ${isPartnershipMilestone ? finalBalls : ""}

RAW COMMENTARY:
"${cleanCommentary}"

TEAMS:
team1: ${team1Short}
team2: ${team2Short}
battingTeam: ${battingTeam}

=====================================================
STRICT NAME RULES
=====================================================
- NEVER take batter or bowler names from commentary.
- ONLY use provided fields:
      batter = batterName
      bowler = bowlerName
- Extract fielder ONLY from:
      "Caught by NAME"
      "run out (A/B)" → use A
- For "Caught & Bowled", use bowlerName as both bowler & fielder.

=====================================================
SIX / FOUR RULES
=====================================================
- MUST mention:
      batterName
      bowlerName
- Commentary is ONLY for:
      shot type, direction, emotion, timing words
- NO numbers, NO other names, NO long analysis.
- ONE sentence only, max 18 words.

=====================================================
WICKET RULES
=====================================================
If fielder exists:
   "<batterName> dismissed! <fielder> takes it off <bowlerName>."
If bowled/LBW:
   "<bowlerName> removes <batterName>."
If run out:
   "<batterName> run out by <fielder>."

=====================================================
MILESTONE RULES
=====================================================
TEAM_MILESTONE:
   "<battingTeam> bring up ${milestone} in ${finalBalls} balls."
BATSMAN_MILESTONE:
   "${bat1} brings up ${milestone} off ${finalBalls} balls."
PARTNERSHIP_MILESTONE:
   "${bat1} & ${bat2} bring up ${finalRuns} off ${finalBalls} balls."

=====================================================
HEADLINE RULES
=====================================================
- ALL CAPS
- EXACTLY ONE emoji
- 3–7 words
Emoji logic:
  SIX → 🔥 💥 🚀 🌟
  FOUR → ⚡ ✨ 🔥
  WICKET → 🎯 ❌ 🔴
  MILESTONE → ⭐ 👏 🔥

=====================================================
OUTPUT FORMAT
=====================================================
<HEADLINE_WITH_ONE_EMOJI>
<one_sentence_body>
`;

  try {
    const res = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 90,
      temperature: 0.85,
    });

    return res.choices?.[0]?.message?.content?.trim() || null;
  } catch (err) {
    console.log("AI commentary tweet failed:", err.message);
    return null;
  }
}
