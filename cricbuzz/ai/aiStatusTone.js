// aiStatusTone.js
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateStatusTone(statusText) {
  if (!statusText) return statusText;

  const prompt = `
Rewrite this cricket chase/status line in a fresh short tone.
Keep it under 12 words. Make it crisp and human.

"${statusText}"
`;

  try {
    const res = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 30,
      temperature: 0.7,
    });

    const out = res.choices?.[0]?.message?.content?.trim();
    return out || statusText;
  } catch (err) {
    console.log("AI status tone failed:", err.message);
    return statusText;
  }
}
