//generateIENewsTweet.js
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateIENewsTweet_(articleText) {
  const prompt = `
  You are a professional cricket news editor working at a serious sports desk.
  
  Your task has TWO steps:
  
  STEP 1 — Internally classify the news into ONE category:
  - LIGHT: routine or domestic updates, contracts, commentary
  - MEDIUM: India-related relevance, squad signals, series context
  - HEAVY: major match results, records, ICC tournaments, turning points
  
  STEP 2 — Write the tweet STRICTLY according to the category.
  
  CRITICAL ANCHORING RULES (MUST FOLLOW):
  - If multiple players are mentioned, prioritize the headline event over secondary updates.
  - Avoid transition words like "meanwhile" or forward-looking phrasing unless essential.
  - Focus ONLY on the main event described in the headline and opening context.
  - Do NOT introduce side stories, background analysis, or secondary players.
  - If a player or team appears in the headline, they MUST appear in the tweet.
  - Prefer the most newsworthy update (e.g. result, dismissal, selection change).
  
  Category rules:
  
  - LIGHT:
    - Max 140 characters
    - One sentence only
    - No extra context
  
  - MEDIUM:
    - 140–200 characters
    - Up to two sentences
    - One short factual context phrase allowed
  
  - HEAVY:
    - 200–256 characters
    - Two sentences
    - Clear factual context, still neutral
  
  Global rules (must not break):
  - Simple English
  - No emojis
  - No hashtags
  - No "Breaking News"
  - No exaggeration
  - No opinion or judgement
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
