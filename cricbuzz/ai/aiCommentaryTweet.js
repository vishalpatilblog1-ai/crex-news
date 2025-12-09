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

  const prompt = `
  You are a cricket AI that generates short, simple, emotional commentary for SIX, FOUR, WICKET, and milestone events.

  =====================================================
  LANGUAGE RULES
  =====================================================
  - Use simple English a 5th-grade student can understand.
  - Keep emotions, but stay easy and clean.
  - Never guess anything. Use ONLY the data provided.
  - Output must always have EXACTLY two lines:
    1) SHORT HEADLINE (ALL CAPS)
    2) SIMPLE COMMENTARY SENTENCE
  
  =====================================================
  EVENT DATA (DO NOT GUESS ANYTHING)
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
  - NEVER take names from commentary.
  - ONLY use batterName and bowlerName given above.
  - If bowlerName is missing, do not invent one.
  
  =====================================================
  HEADLINE RULES (FIRST LINE)
  =====================================================
  // - ALL CAPS
  // - 3–6 words only
  // - Must clearly include the event type:
  //     SIX / FOUR / WICKET / PARTNERSHIP
  // - Add EXACTLY ONE emoji at the end
  // - Must be simple and emotional:
  //   Example style:
  //     BIG COVER DRIVE FOUR 💥
  //     STRONG MID-WICKET SIX 🔥
  //     SIMPLE, CLEAN WICKET 📛

  - ALL CAPS
  - EXACTLY 1 word only   ← (changed from 3–6 words)
  - Word must be the event type:
        SIX / FOUR / WICKET / PARTNERSHIP / FIFTY / HUNDRED
  - Add EXACTLY ONE emoji at the end
  - Must be simple and emotional
    Example style:
      FOUR 💥
      SIX 🔥
      WICKET 📛
      PARTNERSHIP 🤝
      FIFTY 🟡
      HUNDRED 🟦
      MAIDEN
  
  =====================================================
  BODY RULES (SECOND LINE)
  =====================================================
  - One single sentence (max 18 words)
  - Very simple English
  - No emojis
  - Include batterName and bowlerName
  - Must describe action with simple cricket words (cover, point, mid-wicket, long-on, straight, cut, pull, drive)
  - Never mention:
    - numbers
    - fielders
    - match situation
    - dismissal method
  
  =====================================================
  WICKET SENTENCE RULES (BODY)
  =====================================================
  If bowlerName exists, choose ONE:
    "<batterName> falls! <bowlerName> strikes again."
    "<batterName> falls! <bowlerName> breaks the stand."
    "<batterName> falls! <bowlerName> delivers the breakthrough."
    "<batterName> falls! <bowlerName> ends the resistance."
    "<batterName> falls! <bowlerName> produces the big wicket."
  
  If bowlerName is missing, choose ONE:
    "<batterName> falls! Big breakthrough."
    "<batterName> falls! Huge moment."
    "<batterName> falls! Pressure rises."
    "<batterName> falls! The game shifts."

  =====================================================
  MILESTONE RULES (BODY)
  =====================================================
  - For ALL milestone types (TEAM_MILESTONE, BATSMAN_MILESTONE, PARTNERSHIP_MILESTONE):
  - Milestone sentences must ONLY mention:
   - battingTeam (for team milestone)
   - bat1 (for batsman milestone)
   - bat1 and bat2 (for partnership milestone)
 - Ignore bowlerName completely for milestone events.
 - Milestone sentences MAY mention the opponent TEAM name.
   Example: "against Australia", "versus South Africa", "against ENG".
 - NEVER mention individual bowler or fielder names in milestone events.
 - Team-level references are allowed; player-level references are forbidden.

  TEAM_MILESTONE:
     "${battingTeam} bring up ${milestone}."
  
  BATSMAN_MILESTONE:
     "${bat1} reaches ${milestone}."
  
  PARTNERSHIP_MILESTONE:
     "${bat1} and ${bat2} bring up ${finalRuns} together."
  
  =====================================================
  FINAL OUTPUT FORMAT (STRICT)
  =====================================================
  <HEADLINE_WITH_ONE_EMOJI>
  <ONE_SIMPLE_SENTENCE>  
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
