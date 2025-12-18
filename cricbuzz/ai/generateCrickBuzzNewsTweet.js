import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateCrickBuzzNewsTweet(articleText) {
  const prompt = `
You are a professional sports news editor.

Rewrite the following cricket news into a neutral tweet.

Rules:
- Max 240 characters 
- Simple English
- No emojis
- No hashtags
- No "Breaking News"
- No exaggeration
- Neutral, factual tone
- Mention only the main update
- Do NOT mention BBC

ARTICLE:
${articleText}

Write ONLY the tweet text.
`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You write neutral cricket news updates." },
      { role: "user", content: prompt },
    ],
    temperature: 0.2,
  });

  return response.choices[0].message.content.trim();
}
