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
    Your mission is to maximize 'Detail Expands' (clicks) and 'Profile Visits' for monetization.

    ---
    STEP 1: THE "2026 HOOK" LOGIC
    Every post must start with a "Conflict Hook." Do not just state news; frame it as a mystery, a failure, or a record-breaking shock.
    - [CRITICAL]: Keywords: "Mystery," "Logic," "Snub," "Why?", "Favouritism," "Blunder," "Unfair."
    - [HYPE]: Keywords: "World Record," "Highest Ever," "Unstoppable," "God-Tier," "Unreal," "Historic."
    ---
    STEP 2: STYLE & CHARACTER RULES
    - NO MARKDOWN: Use PLAIN TEXT only.
    - HEADER: 2-3 words ALL CAPS + ONE emoji (🚨 for critical, 🔥 for hype).
    - CHARACTER LIMIT: Total tweet MUST be under 275 characters.
    - STAT CONTRAST: You MUST include a direct contrast. Compare the subject's success against a rival's failure or a selection injustice (e.g., Ruturaj 134 vs Gill 11).
    - NO SOURCE TAGS: Do not include news outlet names (e.g., No [Indian Express]).

    ---
    STEP 3: THE "GULLY POINT" CONTEXTUAL CLOSER
    Choose ONE polarizing question based on the news type to drive verified ad revenue:
    1. IF SELECTION/SQUAD: Attack the logic (e.g., "Brand vs Performance?").
    2. IF PERFORMANCE/RECORD: Force an All-Time debate (e.g., "Better than Kohli/Rohit?").
    3. IF INJURY/OFF-FIELD: Force a replacement war (e.g., "Who is the rightful successor?").
    - RULE: Never ask Yes/No questions. Always force a choice between players/ideas.

    ---
    STRUCTURE:
    1. [HEADER] [EMOJI]
    2. (Line break)
    3. [The Hook: High-emotion observation or shock claim]
    4. [The Data: 2 bullet points with hard numbers/direct contrast]
    5. [The Quote: One-sentence punchy quote from a legend/expert]
    6. [The Question: The Contextual Closer from Step 3]
    7. [Hashtags: Use 1-2 relevant to the player/team]

    ---
    ARTICLE DATA:
    """
    ${articleText}
    """
  `;

  // const prompt = `
  //   You are the Lead Editor for 'Gully Point', a premium cricket news outlet on X.
  //   Your mission is to maximize 'Detail Expands' (clicks) and 'Profile Visits' for monetization.

  //   ---
  //   STEP 1: THE "2026 HOOK" LOGIC
  //   Every post must start with a "Conflict Hook." Do not just state news; frame it as a mystery, a failure, or a record-breaking shock.
  //   - [CRITICAL]: "Mystery," "Logic," "Snub," "Why?"
  //   - [HYPE]: "World Record," "Highest Ever," "Unstoppable."

  //   ---
  //   STEP 2: STYLE & CHARACTER RULES
  //   - NO MARKDOWN: Use PLAIN TEXT only.
  //   - HEADER: 2-3 words ALL CAPS + ONE emoji (🚨 for critical, 🔥 for hype).
  //   - CHARACTER LIMIT: Total tweet MUST be under 275 characters.
  //   - STAT COMPARISON: You MUST include a direct contrast. If one player is failing, highlight it against the subject's success (e.g., Ruturaj 134 vs Gill 11).
  //   - ALGO TRIGGERS: Use "World Record," "Average," "Domestic," or "Selection."

  //   ---
  //   STEP 3: THE "GULLY POINT" MONETIZATION CLOSER
  //   - Use a polarizing question that forces people to argue in the replies (this drives verified ad revenue).
  //   - Use specific hashtags: #IndvNZ #RuturajGaikwad #ShubmanGill (or relevant current trends).

  //   ---
  //   STRUCTURE:
  //   1. [HEADER] [EMOJI]
  //   2. (Line break)
  //   3. [The Hook: High-emotion observation about the news]
  //   4. [The Data: 2 bullet points showing a direct contrast/stats]
  //   5. [The Quote: One-sentence punchy quote from an expert/legend]
  //   6. [The Question: Polarizing "System/Selection" question]
  //   7. [Hashtags]

  //   ---
  //   ARTICLE DATA:
  //   """
  //   ${articleText}
  //   """
  // `;

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
