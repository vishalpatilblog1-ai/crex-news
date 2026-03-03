// news/ai/judgeNewsContext.js

import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function judgeNewsContext({ articleText, existingContexts = [] }) {
  if (!articleText || articleText.length < 50) {
    throw new Error("Article text too short for context judgment");
  }

  //   const systemPrompt = `
  // You are a cricket news editor.

  // Your job:
  // 1. Read a new cricket news article.
  // 2. Summarize its core meaning in ONE or TWO sentences (this is the newContext).
  // 3. Compare this meaning with the list of contexts already covered today.
  // 4. Decide if this new article is essentially the SAME news already covered today.

  // Important rules:
  // - SAME EVENT with same outcome or same core issue = already covered
  // - Same match but DIFFERENT angle (e.g. result vs pitch controversy) = NOT covered
  // - Ignore wording differences and headlines
  // - Focus on cricket meaning, not language

  // Additional rules (VERY IMPORTANT):
  // - If two articles discuss the same topic BUT are driven by different named individuals (players, ex-players, officials), treat them as NOT already covered.
  // - Opinion or statement-based articles from different people are considered DIFFERENT coverage, even if the topic overlaps.
  // - Only mark as already covered if BOTH the topic AND the primary speaker/angle are the same.

  // You must return STRICT JSON only.
  // No explanations. No extra text.
  // `;

  const systemPrompt = `
You are a cricket news deduplication engine.

Your job:
1. Read a new cricket news article.
2. Summarize its core development in ONE or TWO sentences (this is the newContext).
3. Compare it with already covered contexts.
4. Decide if this article reports the EXACT SAME development.

STRICT DEDUP RULES:

Only mark as already covered (true) if:
- It reports the SAME factual event
- Same outcome
- Same match result
- Same official announcement
- Same injury update
- Same statement by the SAME person

DO NOT mark as already covered if:
- It is a different angle of the same topic
- It is analysis instead of report
- It is opinion instead of match summary
- It is a different person's reaction
- It adds new detail
- It expands an earlier story
- It is controversy vs result
- It is stat-based vs narrative-based
- It is preview vs result
- It is post-match reaction vs match report

Important:
Even if topic overlaps, treat it as NEW unless it is literally the same development being repeated.

When in doubt → return isAlreadyCovered = false.

Return STRICT JSON only.
No explanation.
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
