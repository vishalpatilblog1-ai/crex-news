import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function generateTweet(event) {
  const prompt = `
Write a short cricket tweet for this event:
${JSON.stringify(event)}

Rules:
- Very simple English
- Max 2 emojis
- Factual, neutral
- No hype
- Under 180 characters
`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });

  return response.choices[0].message.content.trim();
}
