import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Add Indian player emoji only
function addIndianEmoji(name) {
  if (!name) return "";
  const indian = [
    "Rohit",
    "Kohli",
    "Jadeja",
    "Bumrah",
    "Siraj",
    "Kuldeep",
    "Gill",
    "Pant",
  ];
  return indian.some((i) => name.includes(i)) ? " 🇮🇳🔥" : "";
}

export default async function generateTweet(event) {
  const emoji = event.player
    ? addIndianEmoji(event.player)
    : event.batsman
    ? addIndianEmoji(event.batsman)
    : event.bowler
    ? addIndianEmoji(event.bowler)
    : "";

  const prompt = `
Write a short cricket tweet:

Event:
${JSON.stringify(event)}

Rules:
- Simple English
- Max 2 emojis
- Factual
- Add this emoji if Indian player involved: "${emoji}"
- Under 150 characters
  `;

  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });

  return res.choices[0].message.content.trim();
}
