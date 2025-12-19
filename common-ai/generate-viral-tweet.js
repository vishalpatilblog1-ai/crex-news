import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateViralTweet(articleText, number) {
  const prompt = `
    You are an experienced international cricket desk editor.
    
    Rewrite the following cricket news into a concise, neutral tweet suitable for a serious cricket audience.
    
    Guidelines:
    - Max ${number} characters
    - Clear, simple English
    - No emojis
    - No hashtags
    - No "Breaking News"
    - No hype or opinion
    - No moral judgement
    - Avoid copying sentence structure from the source
    - Preserve factual accuracy
    - Maintain a calm, professional newsroom tone
    
    Style instructions:
    - Slightly vary sentence rhythm (avoid flat reporting)
    - Add light contextual framing where relevant (selection, timing, impact)
    - Use natural editorial phrasing rather than headline language
    - Let significance be implied, not stated
    - Sound human, not templated
    
    Focus ONLY on the main update.
    
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
