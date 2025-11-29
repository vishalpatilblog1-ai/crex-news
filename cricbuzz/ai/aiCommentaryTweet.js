// aiCommentaryTweet.js
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate Tweet from commentary + eventType + teams
 * @param {string} eventType - SIX | FOUR | WICKET | MILESTONE etc.
 * @param {string} rawCommentary
 * @param {string} team1Short  - ex: IND, AUS, PAK
 * @param {string} team2Short  - ex: SA, ENG, BAN
 * @param {string} battingTeamShort - current batting team (for emoji tone)
 */

export async function generateCommentaryTweet(
  eventType,
  rawCommentary,
  team1Short,
  team2Short,
  battingTeamShort
) {
  if (!eventType) return "";

  const prompt = `
  You are a cricket AI that converts raw Cricbuzz commentary into a natural, exciting Twitter update.
  
  INPUT:
  eventType: ${eventType}
  commentary: "${rawCommentary}"
  team1: ${team1Short}
  team2: ${team2Short}
  battingTeam: ${battingTeamShort}
  
  RULES:
  - Commentary must be ONE short sentence only (max 15–18 words).
  - Do NOT generate multiple sentences or long paragraphs.
  - No more than 2 lines of text in the main description.
  - Raw commentary may contain tokens like B0$, B$1, BD$, R$1. Ignore them completely.
  - Use eventType (SIX, FOUR, WICKET, etc.) to understand the real event.
  - Extract bowler, batter, shot direction, and action details when possible.
  - NEVER output tokens like B0$, BD$, B$1.

  HEADLINE EMOJI RULE:
- Add exactly ONE emoji in the headline.
- The emoji must MATCH the event type:
   • If FOUR/SIX → use speed/energy emojis (choose any random from this: 🔥,🌟,💥,🚀, 4️⃣).
   • If WICKET → use danger/shock/alert emojis (choose any random from this: ❌, 🎯, ❗️, 🔴).
   • If DOT BALL / misc → use neutral or pressure emojis (theme = tight bowling, tension).
- DO NOT repeat the same emoji every time.
- DO NOT use the examples literally; choose your own emoji naturally based on the theme.
- No emojis for Pakistan.
  
  EMOJI RULES:
  1) If the match involves India (IND):
     - Use positive/emotional emojis for India.
     - Neutral emojis for opponent.
  
  2) If NOT India:
     - Use only neutral cricket/emotion emojis.
  
  3) If Pakistan (PAK) is involved:
     - No emojis for Pakistan.
     - Neutral emojis only for opponent.
  4) - Ensure emojis have proper spacing (e.g., "Starc ⚡", not "Starc⚡").

  
  IMPORTANT:
  - Add exactly **one emoji in the HEADLINE**.
  - Add **1–3 emojis in the main tweet**, placed NATURALLY:
     - can be near batter name
     - can be near shot description
     - can be after bowler name
     - can be anywhere, NOT just at the end.
  - DO NOT copy emojis from examples.
  - Do NOT repeat same emoji pattern each time.
  
  STYLE:
  - Short, exciting, human-like.
  - Output ONLY the tweet.
  
  HEADLINE RULES:
  - ALL CAPS.
  - 3–7 words.
  - Include **one emoji**, placed naturally.
  - Very punchy.
  - Example tones: “KOHLI FINDS FOUR 🔥”, “STARC STRIKES ⚡️”, “WICKET AT COVER 🎯”
  
  OUTPUT FORMAT:
  <HEADLINE WITH ONE EMOJI>
  <tweet sentence>
  `;

  try {
    const res = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 70,
      temperature: 0.85,
    });

    const out = res.choices?.[0]?.message?.content?.trim();
    return out || null;
  } catch (err) {
    console.log("AI commentary tweet failed:", err.message);
    return null;
  }
}
