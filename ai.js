import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function generateTweet(eventData) {
  const prompt = `
You are a cricket commentator bot. Write a short, exciting tweet for this event:
${JSON.stringify(eventData)}

Rules:
- Add emojis
- Add 2-3 trending cricket hashtags
- Keep under 220 characters
- Write in a human style
  `;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });

  return response.choices[0].message.content.trim();
}
