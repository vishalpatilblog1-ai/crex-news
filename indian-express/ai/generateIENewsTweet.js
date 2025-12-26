//generateIENewsTweet.js
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateIENewsTweet(articleText) {
  const prompt = `
  You are writing for a sharp, opinion-aware cricket account (GP style).
  The account values credibility, but also wants to spark discussion.
  
  Your task has TWO steps:
  
  STEP 1 — Internally classify the news into ONE category:
  - LIGHT: routine or domestic updates, contracts, commentary
  - MEDIUM: India-related relevance, squad signals, selection movement
  - HEAVY: major match results, debuts, records, turning points, big decisions
  
  STEP 2 — Write the tweet STRICTLY according to the category,
  using OPINION-ADJACENT FRAMING (not pure news).
  
  CRITICAL ANCHORING RULES (MUST FOLLOW):
  - The framing MUST directly reflect the headline outcome.
  - Avoid transition words like "meanwhile" unless strictly required.
  - If the headline mentions a dismissal, failure, or setback, the tweet MUST acknowledge it explicitly.
  - The tweet MUST stay centered on the headline event.
  - Avoid future-oriented phrases like "will be", "aims to", "set to".
  - Do NOT shift focus to secondary players or unrelated storylines.
  - If the headline mentions a player or team, they MUST appear in the tweet.
  - Do NOT invent pressure, form issues, or future scenarios not implied by the article.
  
  Tone & framing rules (VERY IMPORTANT):
  - If the headline describes a negative or contrasting outcome, the framing MUST reflect that contrast.
  - Do NOT exaggerate
  - Do NOT accuse or abuse
  - Do NOT speculate wildly
  - Add ONLY ONE subtle angle such as:
    - timing
    - contrast
    - implication
    - consequence
  - Let the reader complete the thought
  - Sound human, not like a press release
  
  Category rules:
  
  - LIGHT:
    - Max 140 characters
    - One sentence only
    - Slight framing allowed (timing or context)
  
  - MEDIUM:
    - 140–200 characters
    - Up to two sentences
    - One implication or contrast is mandatory
  
  - HEAVY:
    - 200–256 characters
    - Two sentences
    - Frame the significance or shift in narrative without emotion
  
  Global rules (must not break):
  - Simple English
  - No emojis
  - No hashtags
  - No "Breaking News"
  - No sensational words
  - No direct opinions like "right/wrong"
  - No questions
  - No mention of the source
  - Do NOT reveal the category
  
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
