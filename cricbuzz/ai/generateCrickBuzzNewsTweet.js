import OpenAI from "openai";
import { bold } from "../templates.js";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateCrickBuzzNewsTweet(
  headline,
  intro,
  fullArticleText
) {
  // const isQuotedHeadline =
  //   headline.trim().startsWith("'") ||
  //   headline.trim().startsWith("“") ||
  //   headline.includes('"');

  // const isControversy =
  //   /dictator|assault|alleged|accused|controversy|dressing room|feud|clash|fight|criticism/i.test(
  //     fullArticleText
  //   );

  // let mode = "normal";

  // if (isQuotedHeadline) mode = "quoted";
  // else if (isControversy) mode = "controversy";

  const prompt = `
You are an expert cricket journalist writing for X (Twitter).
Write ONE tweet within 280 characters.

MODE: ${mode}

GUIDELINES:
- Output must be multi-line.
- Use short paragraphs (1–2 sentences per paragraph).
- Use simple English that a 5th grade student can understand.
- Add 1–2 relevant emojis based on context — but DO NOT use 🚨 siren emoji.
- Add 1-2 relevant cricket-related hashtags.
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
