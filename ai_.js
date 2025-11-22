import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Add ONLY one India emoji + one India flag for positive Indian events
function getIndiaEmoji() {
  return " 🇮🇳🔥";
}

export default async function generateTweet(event) {
  const indiaBatting = isIndia(event.battingTeam);
  const indiaBowling = isIndia(event.bowlingTeam);

  let toneInstruction = "";
  let emojiInstruction = "";

  // RULE 1: If it's India's positive moment → hype + flag + 1 emoji
  if (
    indiaBatting &&
    (event.type === "FOUR" ||
      event.type === "SIX" ||
      event.type === "MILESTONE")
  ) {
    toneInstruction =
      "Use positive tone. Use just one emoji and one India flag.";
    emojiInstruction = getIndiaEmoji();
  }

  // RULE 2: If opponent hits FOUR or SIX → NEUTRAL tone
  if (!indiaBatting && (event.type === "FOUR" || event.type === "SIX")) {
    toneInstruction =
      "Use strictly neutral tone. No hype words. No emojis. Just update score.";
    emojiInstruction = "";
  }

  // RULE 3: If India takes wicket → Slightly positive with one emoji + flag
  if (indiaBowling && event.type === "WICKET") {
    toneInstruction =
      "Use positive tone but only one emoji and one India flag.";
    emojiInstruction = getIndiaEmoji();
  }

  // RULE 4: Opponent takes wicket of India → NEUTRAL
  if (!indiaBowling && event.type === "WICKET") {
    toneInstruction = "Neutral tone. No excitement. No emojis.";
    emojiInstruction = "";
  }

  // RULE 5: Sessions (Lunch, Tea, Stumps) → neutral
  if (event.type === "SESSION") {
    toneInstruction = "Neutral tone. No emojis.";
    emojiInstruction = "";
  }

  // RULE 6: Toss → neutral
  if (event.type === "TOSS") {
    toneInstruction = "Neutral tone. No emojis.";
    emojiInstruction = "";
  }

  // RULE 7: Match end → winner logic
  if (event.type === "MATCH_END") {
    if (isIndia(event.winner)) {
      toneInstruction = "Positive tone. Only one emoji and one India flag.";
      emojiInstruction = getIndiaEmoji();
    } else {
      toneInstruction = "Neutral tone. No emojis.";
      emojiInstruction = "";
    }
  }

  const prompt = `
Write a short cricket tweet.

Event:
${JSON.stringify(event)}

Tone rule:
${toneInstruction}

Other rules:
- Simple English
- Under 150 characters
- Do NOT add extra emojis except: "${emojiInstruction}"
- Do NOT hype opponent events, only factual score updates.
- Mention batsman and bowler for 4/6
- Mention batsman, bowler, fielder for wicket if available
- If it's India's positive moment, include emojiInstruction exactly once.

Output only tweet.
`;

  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });

  return res.choices[0].message.content.trim();
}

function isIndia(name) {
  return name?.toLowerCase().includes("india");
}
