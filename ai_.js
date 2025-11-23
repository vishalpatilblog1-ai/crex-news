// ai.js
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function isIndia(name) {
  return name?.toLowerCase().includes("india");
}

function indiaEmoji() {
  return "🇮🇳🔥";
}

export function cleanTweet(text) {
  const bannedFlags = ["🇵🇰", "🇱🇰"];

  bannedFlags.forEach((flag) => {
    text = text.replaceAll(flag, "");
  });

  return text.trim();
}

export default async function generateTweet(event) {
  const indiaBatting = isIndia(event.battingTeam);
  const indiaBowling = isIndia(event.bowlingTeam);

  let toneRule = "";
  let allowedEmoji = "";

  if (
    indiaBatting &&
    ["SIX", "MILESTONE", "PARTNERSHIP"].includes(event.type)
  ) {
    toneRule =
      "Positive but simple tone. You can show happiness because it is good for India. Use at most one exclamation mark.";
    allowedEmoji = indiaEmoji();
  }

  if (
    !indiaBatting &&
    ["SIX", "MILESTONE", "PARTNERSHIP"].includes(event.type)
  ) {
    toneRule =
      "Strictly neutral tone. No hype words like great, brilliant, superb, on fire, outstanding. No exclamation marks. Just factual score update.";
    allowedEmoji = "";
  }

  if (indiaBowling && event.type === "WICKET") {
    toneRule =
      "Positive but simple tone, because India took a wicket. Use at most one exclamation mark.";
    allowedEmoji = indiaEmoji();
  }

  if (!indiaBowling && event.type === "WICKET") {
    toneRule =
      "Neutral tone, because India lost a wicket. No emojis, no hype. Just factual description.";
    allowedEmoji = "";
  }

  if (["SESSION", "TOSS"].includes(event.type)) {
    toneRule = "Neutral, informational tone. No emojis.";
    allowedEmoji = "";
  }

  if (event.type === "MATCH_END") {
    if (event.winner && isIndia(event.winner)) {
      toneRule =
        "Positive but simple tone, celebrating India win. One exclamation mark is allowed.";
      allowedEmoji = indiaEmoji();
    } else {
      toneRule =
        "Neutral tone. Congratulate the winner briefly without emojis.";
      allowedEmoji = "";
    }
  }

  const prompt = `
You are a cricket Twitter bot.

Write ONE short tweet based on this event JSON:

${JSON.stringify(event)}

🔵 GENERAL RULES
- Very simple cricket English.
- Max 150 characters.
- Do NOT start with hashtags.
- Always mention Batsman, Bowler, and Fielder (if catch/runout exists).
- Use "<Team> <runs>/<wkts> (<overs>)" format when score exists.
- Output ONLY the tweet.

🔵 Event type safety (very important):
- You MUST trust event.type from the JSON.
- Only if event.type is "WICKET" or "RUN_OUT" you may use words like:
  "out", "wicket", "dismissed", "lbw", "bowled", "caught".
- If event.type is "WIDE" or "NO_BALL" or "LB", you must clearly say it is a wide or no-ball
  and you must NOT say the batter is out.
- If event.type is "SINGLE" or "DOUBLE", just describe the runs. Do NOT mention any wicket.
- Never invent wickets or dismissals that are not present in the JSON.

🔵 STYLE LOGIC
If India player is involved in a positive event (FOUR, SIX, WICKET India took):
  - Use emotional style: smashes, rockets, blasts, launches, magic.
  - Emojis allowed: 🔥💥🚀🇮🇳 (max ONE).
  
If opponent player does something positive:
  - STRICT neutral tone.
  - No hype. No exclamation marks.
  - Emojis allowed: 🙂🤝 (max ONE).

If India loses wicket:
  - Strict neutral tone.
  - No emojis.
  - No praise words.

🔵 EVENT RULES
FOUR:
- Say: "<BATTER> hits a FOUR off <BOWLER>."
- India = emotional. Opponent = neutral.

SIX:
- Say: "<BATTER> hits a SIX off <BOWLER>."
- India = explosive style. Opponent = calm neutral.

WICKET:
- Mention batsman, bowler, AND fielder (if catch).
- India taking wicket = emotional + 🇮🇳🔥 allowed.
- India losing wicket = neutral, no emoji.

RUN OUT:
- Mention batter + fielder.
- India = emotional if India makes runout. Neutral if India gets runout.

MILESTONE:
- Mention player and milestone (50/100).

PARTNERSHIP:
- Mention both batsmen and runs.

TOSS:
- "India won the toss and chose to bat/bowl."

MATCH_END:
- If India wins: short, happy, max one 🇮🇳🔥.
- If India loses: neutral, no emoji.

🔵 HASHTAGS (MANDATORY at end)
- Always use FULL player names without spaces in hashtags.
  Example: “Ruturaj Gaikwad” → #RuturajGaikwad (not #Gaikwad)
- Add exactly 3 tags:
  #<FullBatterName> #<FullBowlerName> #<MatchTag>

Output ONLY the tweet text, nothing else.
`;

  //   const prompt = `
  // You are a cricket Twitter bot.

  // Write ONE short tweet based on this event JSON:

  // ${JSON.stringify(event)}

  // Rules:
  // - Very simple English, like a fan account.
  // - Max 150 characters.
  // - Do NOT start with hashtags.
  // - Put score in this style when possible: "<Team> <runs>/<wickets> (<overs>)".
  // - Mention batsman and bowler for SIX if available.
  // - For WICKET, mention batsman, bowler and fielder if available, plus team score.
  // - For milestones, mention player name and runs.
  // - For partnership milestones, mention both players and partnership runs.
  // - For SESSION events, mention session (Lunch/Tea/Stumps) and current score.
  // - For TOSS, say who won the toss and what they chose.
  // - For MATCH_END, say who won and very short summary.

  // Tone rule:
  // ${toneRule}

  // Emoji rule:
  // - You may use this emoji snippet at most once in the tweet: "${allowedEmoji}"
  // - Do NOT use any other emojis.
  // - If "${allowedEmoji}" is empty, do NOT use emojis at all.

  // Very important:
  // - If the event is good for the opponent (not India), be completely neutral.
  // - No hype words like: great, brilliant, superb, on fire, outstanding, explosive, ruthless.
  // - No extra decoration, no multiple sentences. Just one short clear sentence.

  // Output ONLY the tweet text, nothing else.
  // `;

  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });

  return res.choices[0].message.content.trim();
}
