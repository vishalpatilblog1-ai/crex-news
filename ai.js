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

export default async function generateTweet(event) {
  const indiaBatting = isIndia(event.battingTeam);
  const indiaBowling = isIndia(event.bowlingTeam);

  let toneRule = "";
  let allowedEmoji = "";

  // ---- India positive batting events ----
  if (
    indiaBatting &&
    ["FOUR", "SIX", "MILESTONE", "PARTNERSHIP"].includes(event.type)
  ) {
    toneRule =
      "Positive but simple tone. You can show happiness because it is good for India. Use at most one exclamation mark.";
    allowedEmoji = indiaEmoji(); // exactly one snippet
  }

  // ---- Opponent positive batting events (neutral only) ----
  if (
    !indiaBatting &&
    ["FOUR", "SIX", "MILESTONE", "PARTNERSHIP"].includes(event.type)
  ) {
    toneRule =
      "Strictly neutral tone. No hype words like great, brilliant, superb, on fire, outstanding. No exclamation marks. Just factual score update.";
    allowedEmoji = "";
  }

  // ---- India bowling wicket (good for India) ----
  if (indiaBowling && event.type === "WICKET") {
    toneRule =
      "Positive but simple tone, because India took a wicket. Use at most one exclamation mark.";
    allowedEmoji = indiaEmoji();
  }

  // ---- India batting wicket (good for opponent) ----
  if (!indiaBowling && event.type === "WICKET") {
    toneRule =
      "Neutral tone, because India lost a wicket. No emojis, no hype. Just factual description.";
    allowedEmoji = "";
  }

  // ---- Sessions, Toss, Match End ----
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

Rules:
- Very simple English, like a fan account.
- Max 150 characters.
- Do NOT start with hashtags.
- Put score in this style when possible: "<Team> <runs>/<wickets> (<overs>)".
- Mention batsman and bowler for FOUR and SIX if available.
- For WICKET, mention batsman, bowler and fielder if available, plus team score.
- For milestones, mention player name and runs.
- For partnership milestones, mention both players and partnership runs.
- For SESSION events, mention session (Lunch/Tea/Stumps) and current score.
- For TOSS, say who won the toss and what they chose.
- For MATCH_END, say who won and very short summary.

Tone rule:
${toneRule}

Emoji rule:
- You may use this emoji snippet at most once in the tweet: "${allowedEmoji}"
- Do NOT use any other emojis.
- If "${allowedEmoji}" is empty, do NOT use emojis at all.

Very important:
- If the event is good for the opponent (not India), be completely neutral.
- No hype words like: great, brilliant, superb, on fire, outstanding, explosive, ruthless.
- No extra decoration, no multiple sentences. Just one short clear sentence.

Output ONLY the tweet text, nothing else.
`;

  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });

  return res.choices[0].message.content.trim();
}
