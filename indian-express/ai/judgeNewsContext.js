// news/ai/judgeNewsContext.js

import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
dotenv.config();

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function judgeNewsContext({ articleText, existingContexts = [] }) {
  if (!articleText || articleText.length < 50) {
    throw new Error("Article text too short for context judgment");
  }

  const systemPrompt = `
  You are a cricket news editor for a fast-moving X (Twitter) account.

  Your job:
  1. Read a new cricket news article.
  2. Summarize its core meaning in ONE or TWO sentences (this is the newContext).
  3. Compare this meaning with the list of contexts already covered today.
  4. Decide if this new article is essentially the SAME news already covered today.
  5. Score TWO separate things — do not blend them into one number:

  SIGNIFICANCE SCORE (1-10) — how important is this to an Indian cricket audience:
  9-10 : Major breaking news — key player injury, selection shock, series result, sacking
  7-8  : Meaningful development — squad named, notable performance, coaching decision, controversy
  5-6  : Standard coverage — routine press conference, minor match report, expected squad
  3-4  : Filler — generic preview, repeated angle on an old story, minor domestic fixture
  1-2  : Non-story — listicle, throwback, stats trivia with no live news peg

  VIRALITY SCORE (1-10) — how likely is this specific article to generate replies,
  reposts, and disagreement on social media, independent of how "important" the
  underlying news is:
  9-10 : Genuine surprise or controversy — an unexpected decision, a scandal, a
         named-figure conflict, something that splits opinion into two camps
  7-8  : Real tension or a strong number/record that invites argument — a
         contentious selection, a milestone with an edge to it
  5-6  : Solid but expected — a routine squad announcement, a predictable result
  3-4  : Low reaction potential — retrospective features, career profiles,
         speculative "what if" opinion pieces, routine fitness updates
  1-2  : No reaction hook at all — pure informational content, listicles

  IMPORTANT: significance and virality are NOT the same axis. A long profile piece
  on a coach's career journey can be significant (a real coaching appointment) but
  score LOW on virality (nothing to disagree with, no surprise, no stakes). A minor
  controversy involving a beloved player can score LOW on significance but HIGH on
  virality. Score each independently — do not let one influence the other.

  Deduplication rules:
  - SAME EVENT with same outcome or same core issue = already covered
  - Same match but DIFFERENT angle (e.g. result vs pitch controversy) = NOT covered
  - Ignore wording differences and headlines
  - Focus on cricket meaning, not language
  - If two articles discuss the same topic BUT are driven by different named individuals
    (players, ex-players, officials), treat them as NOT already covered.
  - Opinion or statement-based articles from different people are considered DIFFERENT
    coverage, even if the topic overlaps.
  - Only mark as already covered if BOTH the topic AND the primary speaker/angle are the same.

  You must return STRICT JSON only — no markdown code fences, no explanations,
  no extra text before or after the JSON object.
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
  "significanceScore": <integer between 1 and 10>,
  "viralityScore": <integer between 1 and 10>
}
`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 400,
    temperature: 0,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const usage = response.usage;
  const inputCost = (usage.input_tokens / 1_000_000) * 1;
  const outputCost = (usage.output_tokens / 1_000_000) * 5;
  console.log(
    `💰 judgeNewsContext (Haiku) — input: ${usage.input_tokens} tok, output: ${usage.output_tokens} tok, cost: $${(inputCost + outputCost).toFixed(4)}`,
  );

  const textBlock = response.content.find((block) => block.type === "text");
  const raw = textBlock?.text;

  if (!raw) {
    throw new Error("AI returned empty response");
  }

  // Strip markdown code fences if the model wraps the JSON despite instructions
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
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

  const significanceScore =
    typeof parsed.significanceScore === "number" &&
    parsed.significanceScore >= 1 &&
    parsed.significanceScore <= 10
      ? Math.round(parsed.significanceScore)
      : null;

  const viralityScore =
    typeof parsed.viralityScore === "number" &&
    parsed.viralityScore >= 1 &&
    parsed.viralityScore <= 10
      ? Math.round(parsed.viralityScore)
      : null;

  return {
    newContext: parsed.newContext.trim(),
    isAlreadyCovered: parsed.isAlreadyCovered,
    matchedIndex: parsed.matchedIndex,
    confidence: Number(parsed.confidence.toFixed(2)),
    significanceScore,
    viralityScore,
  };
}
