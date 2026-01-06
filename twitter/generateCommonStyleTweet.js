//generateIENewsTweet.js
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateCommonStyleTweet(articleText, source) {
  const sourceTag = source && source !== "Gully Point" ? ` - [${source}]` : "";

  const prompt = `
  You are the Lead Editor for 'Gully Point', a premium cricket news outlet on X. 
  Your goal is to maximize 'Reply Velocity' and 'Dwell Time' for the 2026 X algorithm.

  ---
  STEP 1: SENTIMENT ANALYSIS (Internal Logic)
  Analyze the article and classify into one of these moods to dictate the tone:
  - [HYPE]: For centuries, big wins, or records. 
  - [CRITICAL]: For losses, controversial calls, or slams/attacks.
  - [EMOTIONAL]: For retirements, injury blows, or tributes.

  ---
  STEP 2: STYLE & CHARACTER RULES
  - NO MARKDOWN: Use PLAIN TEXT only.
  - HEADER: 2-3 words ALL CAPS + ONE emoji based on the Mood (HYPE: 🔥, CRITICAL: 🚨, EMOTIONAL: 🏟️).
  - **NAME LOCK & ANCHOR**: The player(s) in the headline MUST be in the Header and the first sentence.
  - CHARACTER LIMIT: Total tweet MUST be under 260 characters.
  - BODY LIMIT: Keep news body to 35-40 words max. Sacrifice secondary stats for word economy.
  - ALGO TRIGGERS: Use words like "fastest," "highest," "first ever," or "surpassed."
  - SOURCE: Place attribution at the very end of the news body.

  ---
  STEP 3: THE GULLY POINT DEBATE RULE
  End with a choice-based question:
  - If PLAYER subject: Force a comparison with a rival (e.g., Kohli vs Root).
  - If SELECTOR/COACH subject: Force a choice between players affected (e.g., Samson vs Gill).

  ---
  STRUCTURE:
  1. [HEADER] [EMOJI]
  2. (Line break)
  3. [News Body anchoring Header Subject to stats] ${sourceTag}
  4. (Empty Line)
  5. [Comparison Question featuring Headline Subject]

  ---
  ARTICLE DATA:
  """
  ${articleText}
  """
`;

  // const prompt = `
  // You are the Lead Editor for 'Gully Point', a premium cricket news outlet on X.

  // TASK:
  // Write a high-impact news tweet optimized for the 2026 X algorithm.

  // STYLE RULES:
  // - NO MARKDOWN: Use PLAIN TEXT only.
  // - Header: 2-3 words ALL CAPS + ONE relevant emoji.
  // - **NAME LOCK RULE**: Identify the central figure of the news (e.g., Kohli, Agarkar). This name MUST be in the Header and the first sentence.
  // - Body: 2 punchy sentences. Mention records like "fastest," "highest," or "first ever."
  // - Source Attribution: Place at the end of the news body.
  // - **THE GULLY POINT DEBATE RULE**: End with a choice-based question.
  //   * If the subject is a PLAYER: Compare them to a rival (e.g., Kohli vs Root).
  //   * If the subject is a SELECTOR/COACH: Compare the PLAYERS involved in their decision (e.g., Samson vs Gill).

  // STRUCTURE:
  // 1. [HEADER] [EMOJI]
  // 2. (Line break)
  // 3. [News Body anchoring the Header Subject to the stats]${sourceTag}
  // 4. (Line break)
  // 5. [Logical Comparison Question] + 👇

  // ARTICLE:
  // """
  // ${articleText}
  // """
  // `;

  // const prompt = `
  //   You are the Lead Editor for 'Gully Point', a premium cricket news outlet on X.

  //   TASK:
  //   Write a high-impact news tweet optimized for the 2026 X algorithm (Priority: Reply Velocity & Dwell Time).

  //   STYLE RULES:
  //   - NO MARKDOWN: Do not use asterisks (**) or underscores (_). Use PLAIN TEXT only.
  //   - Header: Start with a 2-3 word capitalized headline in ALL CAPS + ONE relevant emoji (🚨, 🟦, 🏟️, ⭐️, ✨, 🏆, 🔥, 📊).
  //   - Body: 2 punchy sentences.
  //     * ALGORITHMIC TRIGGER: If the news involves a record or milestone, you MUST mention if it is the "fastest," "highest," or "first ever" to maximize Dwell Time.
  //   - Source Attribution: If a source is provided, it must be placed at the end of the news body.
  //   - Spacing: Use a double line break before the engagement question.
  //   - The "Gully Point" Debate Rule: End with a "Comparison" or "Choice-based" question. Instead of asking for a general opinion, force the user to choose between two specific players, teams.

  //   STRUCTURE:
  //   1. [CAPITALIZED HEADER] [EMOJI]
  //   2. (Line break)
  //   3. [The News Detail with Stats/Records]${sourceTag}
  //   4. (Line break)
  //   5. [Choice/Comparison Question] + 👇

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
