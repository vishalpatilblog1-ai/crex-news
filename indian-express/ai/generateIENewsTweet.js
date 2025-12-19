//generateIENewsTweet.js
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateIENewsTweet(articleText) {
  const prompt = `
You are a professional cricket news editor working at a serious sports desk.

Your task has TWO steps:

STEP 1 — Internally classify the news into ONE category:
- LIGHT: routine or domestic updates, contracts, commentary
- MEDIUM: India-related relevance, squad signals, series context
- HEAVY: major match results, records, ICC tournaments, turning points

STEP 2 — Write the tweet STRICTLY according to the category:

- LIGHT:
  - Max 140 characters
  - One sentence only
  - No extra context

- MEDIUM:
  - 140–200 characters
  - Up to two sentences
  - One short contextual phrase allowed

- HEAVY:
  - 200–256 characters
  - Two sentences
  - Clear context, still neutral

Global rules (must not break):
- Simple English
- No emojis
- No hashtags
- No "Breaking News"
- No exaggeration or opinion
- Neutral, factual tone
- Mention only the main update
- Do NOT mention the source
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
