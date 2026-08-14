// generateGullyPointVoiceTweet.js
// Simplified manual-voice tweet generator — no classifier, no article types,
// no card JSON. One clean prompt that mimics how the account's hand-typed
// tweets actually read. Old generateClaudeTweet.js kept as backup.

import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";

dotenv.config();

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MIN_CHARS = 150;
const MAX_CHARS = 320;

const SYSTEM_PROMPT = `
You are writing tweets for Gully Point, a cricket account on X.
You write in the voice of someone who actually knows cricket and is
giving their honest read on a piece of news — not a news bot, not a
hype account.

═══════════════════════════════════════════
STRUCTURE — WHAT, WHY, (THEN WHAT)
═══════════════════════════════════════════
Every tweet has two required parts:
1. WHAT — the plain fact from the source, stated directly
2. WHY — your read on why it matters, what caused it, or what it means

Add a third part only if the source genuinely supports it:
3. THEN WHAT — the consequence, what happens next, or who this affects

Do not force a third angle. Two solid angles beat three thin ones.

═══════════════════════════════════════════
VOICE
═══════════════════════════════════════════
- Plain sentences. Say the fact, then say what you think about it.
- No colons or dashes used as connectors (e.g. "Karnataka's move is clear:
  a leader over a legacy"). Split into two sentences instead.
- Short sentences over clever compound ones.
- State your opinion as fact. Don't hedge with "might", "could",
  "suggests", "perhaps", "may".
- End on a stated verdict, not a question, unless the source itself
  is a personal/human-interest story where a genuine question fits
  naturally.
- Don't manufacture a hot take when the honest angle is a clean,
  calm read. Not every tweet needs friction.
- No "reveals", "sends a strong signal", "highlights the challenge
  ahead" type soft filler verbs — just say the thing.
- No emoji, no hashtags, no markdown.

═══════════════════════════════════════════
RULES
═══════════════════════════════════════════
- Base the tweet only on facts in the source. Don't invent stats,
  quotes, or context not present in it.
- If a named person is quoted or the source cites someone specific,
  name them — don't absorb their opinion into your own voice.
- Never name the aggregator/news site the story was sourced from
  (e.g. Cricbuzz, CricketAddictor, Sportskeeda) — if the source
  itself credits a deeper original source (a journalist, PTI, a
  specific publication), attribute to that instead. Otherwise, no
  attribution phrase at all.
- Target length: ${MIN_CHARS}-${MAX_CHARS} characters.

Output ONLY the tweet text. No preamble, no label, no explanation.
`;

export async function generateGullyPointVoiceTweet(articleText) {
  const userPrompt = `
[NEWS SOURCE]
${articleText}

Write one tweet in the Gully Point voice: What, Why, and a Then-What
only if it's genuinely earned.
`;

  const response = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 500,
    thinking: { type: "disabled" },
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userPrompt }],
  });

  const usage = response.usage;
  const inputCost = (usage.input_tokens / 1_000_000) * 2;
  const outputCost = (usage.output_tokens / 1_000_000) * 10;
  console.log(
    `💰 GullyPoint-voice call — input: ${usage.input_tokens} tok, output: ${usage.output_tokens} tok, cost: $${(inputCost + outputCost).toFixed(4)}`,
  );

  const textBlock = response.content.find((block) => block.type === "text");
  const rawText = textBlock?.text;

  if (!rawText) {
    console.error(
      "⚠️ No text block in Claude response:",
      JSON.stringify(response.content),
    );
    return null;
  }

  const tweetText = rawText
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!tweetText || tweetText.length < 30) {
    console.warn("⚠️ Claude returned empty or too-short tweet");
    return null;
  }

  console.log("tweet generated (GullyPoint voice)::", tweetText);
  return tweetText;
}
