// football/ai/judgeFootballNewsContext.js

import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function judgeFootballNewsContext({
  articleText,
  existingContexts = [],
}) {
  if (!articleText || articleText.length < 50) {
    throw new Error("Article text too short for context judgment");
  }

  const systemPrompt = `
You are a football news editor.

Your job:
1. Read a new football news article.
2. Summarize its core meaning in ONE or TWO sentences (this is the newContext).
3. Compare this meaning with the list of contexts already covered today.
4. Decide if this new article is essentially the SAME news already covered today.
5. Score the article's significance for a football audience (1–10).

Deduplication rules:
- SAME EVENT with same outcome or same core issue = already covered
- Same match but DIFFERENT angle (result, tactics, controversy, injury, quotes, transfer implication) = NOT covered
- Ignore wording differences and headlines
- Focus on football meaning, not language
- If two articles discuss the same topic BUT are driven by different named individuals
  (players, coaches, former players, officials), treat them as NOT already covered.
- Opinion or quote-driven articles from different people are considered DIFFERENT coverage.
- Only mark as already covered if BOTH the topic AND the primary speaker/angle are the same.
- World Cup coverage often generates multiple legitimate angles from the same match.
  Do NOT merge them unless they are genuinely repeating the same story.

Significance scoring guide:
9–10 : Major breaking news — star player injury, manager sacking, World Cup shock, major transfer, historic result

7–8  : Meaningful development — squad announcement, tactical shift, notable performance, controversy, milestone

5–6  : Standard coverage — routine match report, press conference, expected lineup news

3–4  : Filler — generic preview, repeated angle on an existing story, minor domestic update

1–2  : Non-story — trivia, throwback, listicle, recycled content without a fresh news peg

You must return STRICT JSON only.
No explanations.
No extra text.
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
  "confidence": <number between 0.0 and 1.0>,
  "significanceScore": <integer between 1 and 10>
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
  } catch {
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

  const significanceScore =
    typeof parsed.significanceScore === "number" &&
    parsed.significanceScore >= 1 &&
    parsed.significanceScore <= 10
      ? Math.round(parsed.significanceScore)
      : null;

  return {
    newContext: parsed.newContext.trim(),
    isAlreadyCovered: parsed.isAlreadyCovered,
    matchedIndex: parsed.matchedIndex,
    confidence: Number(parsed.confidence.toFixed(2)),
    significanceScore,
  };
}
