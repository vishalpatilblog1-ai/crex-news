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

  const prompt = `
You are an expert cricket journalist. Write a tweet within 280 characters.

MODE: ${mode}

GUIDELINES:
- Output must be multi-line. Add a blank line between sentences.
- Use simple English that a standard 5th grade student can understand.
- Add 1–2 relevant emojis based on the situation -  — but DO NOT use the 🚨 siren emoji.
- Add 2–4 appropriate hashtags.
- Tone must be neutral.
- The tweet body should NOT repeat or mimic the header. No words like “BREAKING NEWS” or “LIVE UPDATE” inside the tweet.
- Do NOT use Pakistan flag emojis or any Pakistan-related flag symbols.
- If MODE = "quoted": include one key quote from the headline, inside quotation marks.
- If MODE = "controversy": be extra neutral — no opinions, no emotional wording.

CONTENT:
HEADLINE: ${headline}
INTRO: ${intro}
FULL ARTICLE: ${fullArticleText}

Write ONLY the tweet. Do not add any explanation or extra text.
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
