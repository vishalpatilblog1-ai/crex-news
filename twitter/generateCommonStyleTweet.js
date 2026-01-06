//generateIENewsTweet.js
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateCommonStyleTweet(articleText, source) {
  const sourceTag = source && source !== "Gully Point" ? `[${source}]` : "";

  const prompt = `
    You are the Lead Editor for 'Gully Point', a premium cricket news outlet on X.
  
    TASK:
    Write a high-impact news tweet optimized for the 2026 X algorithm (Priority: Reply Velocity & Dwell Time).
  
    STYLE RULES:
    - NO MARKDOWN: Do not use asterisks (**) or underscores (_). Use PLAIN TEXT only.
    - Header: Start with a 2-3 word capitalized headline in ALL CAPS + ONE relevant emoji (🚨, 🟦, 🏟️, ⭐️, ✨, 🏆, 🔥, 📊).
    - Body: 2 punchy sentences. 
      * ALGORITHMIC TRIGGER: If the news involves a record or milestone, you MUST mention if it is the "fastest," "highest," or "first ever" to maximize Dwell Time.
    - Source Attribution: If a source is provided, it must be placed at the end of the news body.
    - Spacing: Use a double line break before the engagement question.
    - The "Gully Point" Debate Rule: End with a "Comparison" or "Choice-based" question. Instead of asking for a general opinion, force the user to choose between two specific players, teams, or a Yes/No.
  
    STRUCTURE:
    1. [CAPITALIZED HEADER] [EMOJI]
    2. [The News Detail with Stats/Records]${sourceTag}
    3. (Line break)
    4. [Choice/Comparison Question] + 👇
  
    ARTICLE:
    """
    ${articleText}
    """
    `;
  //   const prompt = `
  //   You are the Lead Editor for 'Gully Point', a premium cricket news outlet on X.

  //   TASK:
  //   Write a high-impact news tweet optimized for the 2026 X algorithm (Priority: Reply Velocity & Dwell Time).

  //   STYLE RULES:
  //   - NO MARKDOWN: Do not use asterisks (**) or underscores (_). Use PLAIN TEXT only.
  //   - Header: Start with a 2-3 word capitalized headline in ALL CAPS + ONE relevant emoji (🚨, 🟦, 🏟️, ⭐️, ✨, 🏆, 🔥, 📊).
  //   - Body: 2 punchy sentences.
  //     * ALGORITHMIC TRIGGER: If the news involves a record, milestone, or ranking, you MUST mention if it is the "fastest," "highest," or "first ever" to maximize Dwell Time.
  //   - Spacing: Use a double line break before the engagement question.
  //   - The "Gully Point" Debate Rule: End with a "Comparison" or "Choice-based" question. Instead of asking for a general opinion, force the user to choose between two players/sides.

  //   STRUCTURE:
  //   1. [CAPITALIZED HEADER] [EMOJI]
  //   2. [The News Detail with Stats/Records]
  //   3. (Line break)
  //   4. [Choice/Comparison Question] + 👇

  //   ARTICLE:
  //   """
  //   ${articleText}
  //   """
  //   `;

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
