//generateIENewsTweet.js
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateIENewsTweet(articleText) {
  // const prompt = `
  // You are the Lead Editor for 'Gully Point', a premium cricket news outlet on X.

  // TASK:
  // Write a high-impact news tweet optimized for the 2026 X algorithm.
  // Goal: Maximize Dwell Time (reading) and Reply Velocity (speed of commenting).

  // STYLE RULES:
  // - NO MARKDOWN: Do not use asterisks (**) or underscores (_) for bold/italic. X does not support them.
  // - Header: Start with a 2-3 word capitalized headline in PLAIN TEXT.
  // - Dynamic Emoji: Select the most relevant emoji (🚨, 🟦, 🏟️, ⭐️, ✨, 🏆, 🔥, 📊) and place it AFTER the header.
  // - Body: 2 punchy sentences with specific stats/names.
  // - Engagement: End with a Choice-Based question.
  // - Spacing: Ensure a double line break before the question.

  // STRUCTURE:
  // 1. [HEADER] 🏏
  // 2. [The News Detail]
  // 3. (Line break)
  // 4. [Binary/Choice Question] + 👇

  // ARTICLE:
  // """
  // ${articleText}
  // """
  // `;
  const prompt = `
  You are the Lead Editor for 'Gully Point', a premium cricket news outlet on X.

  TASK:
  Write a high-impact news tweet optimized for the 2026 X algorithm (Priority: Reply Velocity & Dwell Time).

  STYLE RULES:
  - NO MARKDOWN: Do not use asterisks (**) or underscores (_). Use PLAIN TEXT only.
  - Header: Start with a 2-3 word capitalized headline in ALL CAPS + ONE relevant emoji (🚨, 🟦, 🏟️, ⭐️, ✨, 🏆, 🔥, 📊).
  - Body: 2 punchy sentences. 
    * ALGORITHMIC TRIGGER: If the news involves a record, milestone, or ranking, you MUST mention if it is the "fastest," "highest," or "first ever" to maximize Dwell Time.
  - Spacing: Use a double line break before the engagement question.
  - The "Gully Point" Debate Rule: End with a "Comparison" or "Choice-based" question. Instead of asking for a general opinion, force the user to choose between two players/sides or give a Yes/No answer.

  STRUCTURE:
  1. [CAPITALIZED HEADER] [EMOJI]
  2. [The News Detail with Stats/Records]
  3. (Line break)
  4. [Choice/Comparison Question] + 👇

  ARTICLE:
  """
  ${articleText}
  """
  `;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      // { role: "system", content: "You write neutral cricket news updates." },
      {
        role: "system",
        content:
          "You write grounded, opinion-adjacent cricket updates without speculation.",
      },

      { role: "user", content: prompt },
    ],
    temperature: 0.2,
  });

  return response.choices[0].message.content.trim();
}
