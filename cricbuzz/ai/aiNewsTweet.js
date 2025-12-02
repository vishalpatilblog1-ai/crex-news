import OpenAI from "openai";

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
You are an expert cricket journalist writing a 280-char tweet.

MODE: ${mode}

RULES:
- Always multi-line. Add a blank line between sentences.
- No emojis, no hashtags.
- Neutral tone.
- If MODE = quoted → include the key quote from the headline, in quotes.
- If MODE = controversy → be extra neutral. No opinions or emotional phrasing.

HEADLINE: ${headline}
INTRO: ${intro}
FULL ARTICLE: ${fullArticleText}

Write ONLY the tweet. No extra text.
`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You write clean, factual cricket updates." },
      { role: "user", content: prompt },
    ],
  });

  return `
🚨 NEWS UPDATES 🚨

${response.choices[0].message.content.trim()}`;
}
