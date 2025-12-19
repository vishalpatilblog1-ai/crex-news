// generateBBCNewsTweet.js
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateBBCNewsTweet(articleText) {
  const prompt = `
You are a professional cricket news editor working at a serious international sports desk.

Your task has TWO steps:

STEP 1 — Internally classify the news into ONE category:
- LIGHT: routine updates (county signings, coaching roles, domestic contracts)
- MEDIUM: international relevance, squad considerations, series context
- HEAVY: records, major match results, ICC events, significant turning points

STEP 2 — Write the tweet STRICTLY according to the category:

- LIGHT:
  - Max 120 characters
  - One sentence only
  - No extra context

- MEDIUM:
  - 120–180 characters
  - Up to two sentences
  - One short contextual phrase allowed

- HEAVY:
  - 180–240 characters
  - Two sentences
  - Clear global context, still neutral

Global rules (must follow strictly):
- Simple, clear English
- No emojis
- No hashtags
- No "Breaking News"
- Avoid evaluative adjectives such as "remarkable", "dramatic", or "inspiring"
- No exaggeration or opinion
- Neutral, factual tone
- Mention only the main update
- Do NOT mention BBC or the source
- Do NOT reveal the category


ARTICLE:
${articleText}

Write ONLY the tweet text.
`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You write neutral cricket news updates." },
      { role: "user", content: prompt },
    ],
    temperature: 0.2,
  });

  return response.choices[0].message.content.trim();
}
