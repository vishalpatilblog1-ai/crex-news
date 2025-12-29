//generateIENewsTweet.js
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateIENewsTweet_(articleText) {
  const prompt = `
  You are writing for a credible, editorial-style cricket account (GP).
  The account values accuracy, balance, and long-term trust over virality.
  
  Your task has THREE internal steps:
  
  STEP 1 — Classify the article into ONE importance category:
  - LIGHT: routine updates, domestic cricket, commentary, minor developments
  - MEDIUM: India relevance, squad signals, selection movement, form narratives
  - HEAVY: major Test matches, turning points, records, debuts, big decisions
  
  STEP 2 — Select ONE tone (editorial intent):
  - NEWS: factual, descriptive, attribution-based
  - ANALYSIS: implication-focused, balanced explanation
  - CONTEXT: historical or broader framing to reduce heat or repetition
  Use ONLY ONE tone.
  
  STEP 3 — Write the tweet according to BOTH the category and the tone.
  
  ────────────────────────
  ANCHORING RULES (MUST FOLLOW)
  ────────────────────────
  - The tweet MUST directly reflect the headline outcome.
  - Stay centered on the main event only.
  - If the headline mentions a setback, failure, or dismissal, acknowledge it clearly.
  - If a player or team is mentioned in the headline, they MUST appear in the tweet.
  - Do NOT shift focus to secondary players or unrelated storylines.
  - Do NOT invent pressure, form issues, or future scenarios not implied by the article.
  - Avoid future-oriented phrases like “will be”, “aims to”, “set to”.
  
  ────────────────────────
  TONE CONSTRAINTS (VERY IMPORTANT)
  ────────────────────────
  - NEWS:
    - Strictly factual
    - No interpretation or implication language
    - Attribute opinions to sources if present
  - ANALYSIS:
    - Add ONE implication, contrast, or shift
    - No judgement, blame, or exaggeration
  - CONTEXT:
    - Add historical or broader perspective
    - Frame as part of a wider discussion or pattern
    - Soften repetition or controversy
  
  Opinion-adjacent framing is allowed ONLY in ANALYSIS or CONTEXT.
  NEWS must remain neutral and descriptive.
  
  ────────────────────────
  CATEGORY RULES (LENGTH & STRUCTURE)
  ────────────────────────
  - LIGHT:
    - Max 140 characters
    - One sentence
    - Minimal framing
  - MEDIUM:
    - 140–200 characters
    - Up to two sentences
    - One implication or contrast allowed
  - HEAVY:
    - 200–256 characters
    - Two sentences
    - Frame significance calmly, without emotion
  
  ────────────────────────
  GLOBAL RULES (MUST NOT BREAK)
  ────────────────────────
  - Simple, clear English
  - No emojis
  - No hashtags
  - No questions
  - No sensational language
  - No direct opinions like “right” or “wrong”
  - No mention of the source
  - Do NOT reveal category or tone
  
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
