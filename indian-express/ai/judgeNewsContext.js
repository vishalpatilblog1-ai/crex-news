// news/ai/judgeNewsContext.js

import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// /**
//  * Judge whether a news article's context is already covered today.
//  *
//  * @param {Object} params
//  * @param {string} params.articleText - Full article body
//  * @param {string[]} params.existingContexts - Array of 1–2 sentence summaries already posted today
//  *
//  * @returns {Promise<{
//  *   newContext: string,
//  *   isAlreadyCovered: boolean,
//  *   matchedIndex: number | null,
//  *   confidence: number
//  * }>}
//  */
export async function judgeNewsContext({ articleText, existingContexts = [] }) {
  if (!articleText || articleText.length < 50) {
    throw new Error("Article text too short for context judgment");
  }

  const systemPrompt = `
You are a cricket news editor.

Your job:
1. Read a new cricket news article.
2. Summarize its core meaning in ONE or TWO sentences (this is the newContext).
3. Compare this meaning with the list of contexts already covered today.
4. Decide if this new article is essentially the SAME news already covered today.

Important rules:
- SAME EVENT with same outcome or same core issue = already covered
- Same match but DIFFERENT angle (e.g. result vs pitch controversy) = NOT covered
- Ignore wording differences and headlines
- Focus on cricket meaning, not language

You must return STRICT JSON only.
No explanations. No extra text.
`;

  const userPrompt = `
NEW ARTICLE:
"""
${articleText}
"""

TODAY'S ALREADY COVERED CONTEXTS:
${
  existingContexts.length === 0
    ? "- None"
    : existingContexts.map((c, i) => `${i}. ${c}`).join("\n")
}

Return JSON in this exact format:
{
  "newContext": "<1-2 sentence summary>",
  "isAlreadyCovered": true | false,
  "matchedIndex": <number or null>,
  "confidence": <number between 0.0 and 1.0>
}
`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const raw = response.choices?.[0]?.message?.content;

  if (!raw) {
    throw new Error("AI returned empty response");
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error("AI response is not valid JSON");
  }

  if (typeof parsed.newContext !== "string" || parsed.newContext.length < 20) {
    throw new Error("Invalid newContext from AI");
  }

  if (typeof parsed.isAlreadyCovered !== "boolean") {
    throw new Error("Invalid isAlreadyCovered flag from AI");
  }

  if (parsed.matchedIndex !== null && typeof parsed.matchedIndex !== "number") {
    throw new Error("Invalid matchedIndex from AI");
  }

  if (
    typeof parsed.confidence !== "number" ||
    parsed.confidence < 0 ||
    parsed.confidence > 1
  ) {
    throw new Error("Invalid confidence score from AI");
  }

  return {
    newContext: parsed.newContext.trim(),
    isAlreadyCovered: parsed.isAlreadyCovered,
    matchedIndex: parsed.matchedIndex,
    confidence: Number(parsed.confidence.toFixed(2)),
  };
}
