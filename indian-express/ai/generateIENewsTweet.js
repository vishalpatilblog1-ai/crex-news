//generateIENewsTweet.js
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateIENewsTweet(articleText) {
  const prompt = `
  HARD CONSTRAINT:
Write a factual cricket news tweet in STRICTLY 220–256 characters.

RULES:
- Focus only on the main headline outcome
- Simple, clear English
- Calm, neutral tone
- No emojis, hashtags, or questions
- No sensational language or opinions
- Do not mention sources
- No future projections

ARTICLE:
${articleText}

Write ONLY the tweet text.

  
  `;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      // { role: "system", content: "You write neutral cricket news updates." },
      {
        role: "system",
        content:
          "You write grounded, opinion-adjacent cricket updates without speculation.",
      },

      { role: "user", content: prompt },
    ],
    temperature: 0.2,
  });

  return response.choices[0].message.content.trim();
}
