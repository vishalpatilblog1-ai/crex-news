// ai.js
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Detect India for emotional tone
function isIndia(name) {
  return name?.toLowerCase().includes("india");
}

// Remove banned flags
export function cleanTweet(text) {
  const bannedFlags = ["🇵🇰", "🇱🇰"];
  bannedFlags.forEach((flag) => (text = text.replaceAll(flag, "")));
  return text.trim();
}

export default async function generateTweet(event) {
  const indiaBatting = isIndia(event.battingTeam);
  const indiaBowling = isIndia(event.bowlingTeam);

  // NEW Strong, Clean, Production-Safe PROMPT
  const prompt = `
You are a cricket Twitter bot.

Write ONE short tweet based on this event JSON:

${JSON.stringify(event)}

🔵 GENERAL RULES
- Very simple cricket English.
- Max 150 characters.
- Do NOT start with hashtags.
- Mention Batter, Bowler, and Fielder (only if catch/runout).
- Use "<Team> <runs>/<wkts> (<overs>)" format when score exists.
- Output ONLY the tweet text, nothing else.

🔵 EVENT TYPE SAFETY (VERY IMPORTANT)
You MUST trust event.type EXACTLY:
- Only if event.type is "WICKET" or "RUN_OUT" you may use words like:
  "out", "wicket", "dismissed", "lbw", "bowled", "caught".
- If event.type is "WIDE", "NO_BALL", "LB", or "BYE":
  Describe it as wide/no-ball/leg-bye/bye.
  NEVER mention out, wicket, lbw, caught, bowled.
- If event.type is "SINGLE" or "DOUBLE":
  Only describe the runs. NEVER mention a wicket.
- NEVER invent or assume a wicket that is not present in event.type.

🔵 STYLE LOGIC
If India does a positive event (FOUR, SIX, India takes WICKET, India makes RUN_OUT):
  - Emotional style allowed: smashes, rockets, blasts, launches, magic.
  - ONE emoji allowed (choose from 🔥💥🚀🇮🇳).

If opponent does a positive event:
  - STRICT neutral tone.
  - No hype, no big words.
  - ONE neutral emoji allowed (🙂🤝).

If India loses a wicket:
  - Strict neutral tone.
  - NO emojis.
  - Just factual.

🔵 EVENT RULES
FOUR:
- "<BATTER> hits a FOUR off <BOWLER>."
- India = emotional. Opponent = neutral.

SIX:
- "<BATTER> hits a SIX off <BOWLER>."
- India = explosive. Opponent = calm neutral.

WICKET:
- Mention batsman, bowler, and fielder if available.
- India taking wicket = emotional.
- India losing wicket = neutral.

RUN_OUT:
- Mention batter and fielder.
- India making runout = emotional.
- India losing runout = neutral.

MILESTONE:
- Mention player and milestone (50/100).

PARTNERSHIP:
- Mention both batters + partnership runs.

TOSS:
- "<Team> won the toss and chose to bat/bowl."

MATCH_END:
- If India wins: short + max one 🇮🇳🔥.
- If India loses: neutral, no emoji.

🔵 HASHTAGS (MANDATORY AT END)
- ALWAYS use the FULL player names without spaces.
  Example: "Ruturaj Gaikwad" → "#RuturajGaikwad"
- Add exactly 3 tags:
  #<FullBatterName> #<FullBowlerName> #<MatchTag>

Output ONLY the tweet text.
`;

  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });

  return cleanTweet(res.choices[0].message.content.trim());
}
