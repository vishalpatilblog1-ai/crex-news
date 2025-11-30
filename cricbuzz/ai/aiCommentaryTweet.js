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

  const eventType = event.type;
  const isTeamMilestone = eventType === "TEAM_MILESTONE";
  const isBatsmanMilestone = eventType === "BATSMAN_MILESTONE";
  const isPartnershipMilestone = eventType === "PARTNERSHIP_MILESTONE";

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

  const cleanCommentary = (rawCommentary || "").replace(/\s+/g, " ").trim();

  // FINAL ULTRA-CONTROLLED PROMPT
  const prompt = `
You are a cricket AI that generates extremely crisp, emotional, human-quality commentary for SIX, FOUR, WICKET, and milestone events.

=====================================================
CONTEXT — STRICT (DO NOT GUESS ANYTHING)
=====================================================
eventType: ${eventType}
batterName: ${event.batterName || ""}
bowlerName: ${event.bowlerName || ""}
battingTeam: ${battingTeam}

milestone: ${milestone}
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
${team1Short} vs ${team2Short}

=====================================================
ABSOLUTE NAME RULES
=====================================================
- NEVER extract batter/bowler from commentary.
- ONLY use batterName and bowlerName provided.

=====================================================
SIX / FOUR RULES (MOST IMPORTANT)
=====================================================
1. Output ONLY:
   - One short headline (3–6 words) + ONE emoji
   - One commentary sentence (max 18 words)

2. Headline Rules:
   - HEADLINE MUST BE IN ALL CAPS
   - Creative, emotional, cricket-style
   - No fixed list. AI must generate new phrases every time.

3. Commentary MUST include:
   - batterName
   - bowlerName
   - power/timing/elegance indicator
   - short direction (cover, mid-wicket, point, long-on, square, etc.)

4. Commentary MUST NOT include:
   - Numbers of any kind
   - Other players
   - Match situation
   - Emojis
   - Long descriptions

5. Format EXACTLY:
<HEADLINE>
<one sentence>

=====================================================
WICKET RULES — STRICT + DYNAMIC EMOTIONS
=====================================================
Use ONLY batterName and bowlerName.
NEVER mention fielder.
NEVER mention caught/bowled/LBW/run out.
NEVER guess dismissal style from commentary.
NEVER extract names from commentary.

If bowlerName exists:
   Choose EXACTLY ONE of the following lines:
     "<batterName> falls! <bowlerName> strikes again."
     "<batterName> falls! <bowlerName> breaks the stand."
     "<batterName> falls! A huge moment created by <bowlerName>."
     "<batterName> falls! <bowlerName> delivers the breakthrough."
     "<batterName> falls! <bowlerName> ends the resistance."
     "<batterName> falls! <bowlerName> produces the big wicket."

If bowlerName is missing:
   Choose EXACTLY ONE of the following lines:
     "<batterName> falls! Big breakthrough."
     "<batterName> falls! Huge moment in the match."
     "<batterName> falls! Momentum shifts."
     "<batterName> falls! Pressure back on the batting side."
     "<batterName> falls! Game tilts again."

=====================================================
MILESTONE RULES
=====================================================
TEAM_MILESTONE:
   "${battingTeam} bring up ${milestone}."
BATSMAN_MILESTONE:
   "${bat1} reaches ${milestone}."
PARTNERSHIP_MILESTONE:
   "${bat1} and ${bat2} bring up ${finalRuns} together."

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
      max_tokens: 110,
      temperature: 0.85,
    });

    return res.choices?.[0]?.message?.content?.trim() || null;
  } catch (err) {
    console.log("AI commentary tweet failed:", err.message);
    return null;
  }
}
