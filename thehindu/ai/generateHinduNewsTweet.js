//generateIENewsTweet.js
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateHinduNewsTweet(articleText) {
  const prompt = `
  You are writing for a credible, editorial-style cricket account.
  The account values accuracy, balance, and long-term trust over virality.
  ________________________
  HARD CONSTRAINT:
  ________________________

  Write a factual cricket news tweet in STRICTLY 220–240 characters.
  ________________________
  RULES:
  ________________________
  
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
