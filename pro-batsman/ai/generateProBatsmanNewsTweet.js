// ai/generateProBatsmanNewsTweet.js
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateProBatsmanNewsTweet(articleText) {
  const prompt = `
You are a neutral cricket news editor for a premium Twitter feed.

TASK:
Write a short, factual cricket news tweet based strictly on the article text.

STYLE RULES (VERY IMPORTANT):
- Neutral, newsroom tone
- No opinions, no praise, no criticism
- No sensational language
- No emojis
- No hashtags
- No speculation unless clearly stated as fact
- Avoid words like: "massive", "huge", "shocking", "controversy", "blow", "set to", "likely"
- Do NOT mention sources, journalists, or publication names
- Do NOT say "reports suggest" unless explicitly unavoidable
- Write in simple, clear English

STRUCTURE:
- 2 to 3 short sentences
- Focus on WHAT happened and WHY it matters
- No filler lines

LENGTH:
- Maximum 240 characters
- Prefer 180–220 characters

ARTICLE:
"""
${articleText}
"""
`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "You write clean, neutral cricket news tweets.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.3,
  });

  return response.choices[0]?.message?.content?.trim();
}
