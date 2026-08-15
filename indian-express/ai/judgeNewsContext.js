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

  // Cap to the most recent N -- older-in-the-day contexts are the least
  // likely to be a duplicate of something just published, and this stops
  // the prompt (and cost) from growing across the whole day as more gets
  // tweeted. Take the LAST 20, since contexts are pushed in chronological
  // order and recency is what matters for catching a real duplicate.
  const MAX_EXISTING_CONTEXTS = 20;
  const cappedContexts = existingContexts.slice(-MAX_EXISTING_CONTEXTS);

  const systemPrompt = `
  You are a cricket news editor for a fast-moving X (Twitter) account.

  Your job:
  1. Read a new cricket news article.
  2. Summarize its core meaning in ONE or TWO sentences (this is the newContext).
  3. Compare this meaning with the list of contexts already covered today.
  4. Decide if this new article is essentially the SAME news already covered today.
  5. Score TWO separate things — do not blend them into one number:

  SIGNIFICANCE SCORE (1-10) — how important is this to an Indian cricket audience:
  9-10 : Major breaking news — key player injury, selection shock, series result, sacking, big controversy
  7-8  : Meaningful development — squad named, notable performance, coaching decision, important statement
  5-6  : Standard coverage — routine press conference, normal match report, expected squad news
  3-4  : Filler — generic preview, repeated angle on an old story, minor domestic fixture
  1-2  : Non-story — listicle, throwback, pure stats trivia with no live news peg

  VIRALITY SCORE (1-10) — how likely is this specific article to generate replies, quote tweets, and disagreement:
  9-10 : High conflict potential — unexpected decision, clear two-camp debate, strong criticism of a big name, selection outrage, captaincy controversy
  7-8  : Real tension or strong opinion trigger — contentious selection, sharp statement from a big name, milestone with an edge, visible failure/success that invites judgment
  5-6  : Mild reaction potential — solid but expected news, routine performance praise/criticism
  3-4  : Low reaction potential — retrospective features, career profiles, speculative pieces, routine fitness updates
  1-2  : Almost no reaction hook — pure informational content, dry announcements, listicles

  IMPORTANT RULES:
  - Score Significance and Virality independently. Do not let one influence the other.
  - A story can be high significance + low virality (e.g. routine but important squad announcement).
  - A story can be medium significance + high virality (e.g. a sharp comment that splits fans).
  - Prefer giving high virality scores only when there is clear potential for disagreement or strong emotional reaction.

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
  cappedContexts.length === 0
    ? "- None"
    : cappedContexts.map((c, i) => `${i}. ${c}`).join("\n")
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
    system: [
      {
        type: "text",
        text: systemPrompt,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userPrompt }],
  });

  const usage = response.usage;
  const inputCost = (usage.input_tokens / 1_000_000) * 1;
  const outputCost = (usage.output_tokens / 1_000_000) * 5;
  // console.log(
  //   `💰 judgeNewsContext (Haiku) — input: ${usage.input_tokens} tok, output: ${usage.output_tokens} tok, cost: $${(inputCost + outputCost).toFixed(4)}`,
  // );

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
