import OpenAI from "openai";
import { bold } from "../templates.js";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateNewsTweet(headline, intro, fullArticleText) {
  const isQuotedHeadline =
    headline.trim().startsWith("'") ||
    headline.trim().startsWith("“") ||
    headline.includes('"');

  const isControversy =
    /dictator|assault|alleged|accused|controversy|dressing room|feud|clash|fight|criticism/i.test(
      fullArticleText
    );

  let mode = "normal";

  if (isQuotedHeadline) mode = "quoted";
  else if (isControversy) mode = "controversy";

  //   const prompt = `
  // You are an expert cricket journalist. Write a tweet within 280 characters.

  // MODE: ${mode}

  // GUIDELINES:
  // - Output must be multi-line. Add a blank line between sentences.
  // - Use simple English that a standard 5th grade student can understand.
  // - Add 1–2 relevant emojis based on the situation -  — but DO NOT use the 🚨 siren emoji.
  // - Add 2–4 appropriate hashtags.
  // - Tone must be neutral.
  // - The tweet body should NOT repeat or mimic the header. No words like “BREAKING NEWS” or “LIVE UPDATE” inside the tweet.
  // - Do NOT use Pakistan flag emojis or any Pakistan-related flag symbols.
  // - If MODE = "quoted": include one key quote from the headline, inside quotation marks.
  // - If MODE = "controversy": be extra neutral — no opinions, no emotional wording.

  // CONTENT:
  // HEADLINE: ${headline}
  // INTRO: ${intro}
  // FULL ARTICLE: ${fullArticleText}

  // Write ONLY the tweet. Do not add any explanation or extra text.
  // `;

  const prompt = `
You are an expert cricket journalist writing for X (Twitter).
Write ONE tweet within 280 characters.

MODE: ${mode}

GUIDELINES:
- Output must be multi-line.
- Use short paragraphs (1–2 sentences per paragraph).
- Add ONE blank line between paragraphs (not between every sentence).
- Use simple English that a 5th grade student can understand.
- Add 1–2 relevant emojis based on context — but DO NOT use 🚨 siren emoji.
- Add 2–4 relevant cricket-related hashtags.
- Maintain a neutral, factual tone (no hype, no opinions).
- The tweet body must NOT repeat or mimic the header.
- Do NOT use words like “BREAKING NEWS”, “LIVE UPDATE” inside the tweet body.
- Do NOT use Pakistan flag emojis or Pakistan-related flag symbols.

MODE RULES:
- If MODE = "quoted":
  - Include ONE key quote from the article or headline.
  - The quote must be on its own line.
- If MODE = "controversy":
  - Be strictly neutral.
  - Avoid emotional words, judgments, or speculation.

CONTENT:
HEADLINE: ${headline}
INTRO: ${intro}
FULL ARTICLE: ${fullArticleText}

Write ONLY the tweet text.
Do NOT add explanations, titles, or system messages.
`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You write clear, factual cricket updates." },
      { role: "user", content: prompt },
    ],
  });

  return `

${bold("🚨 BREAKING NEWS 🚨")}

${response.choices[0].message.content.trim()}`;
}
