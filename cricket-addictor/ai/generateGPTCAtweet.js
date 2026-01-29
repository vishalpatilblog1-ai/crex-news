import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * STEP 1: Hook bias selection (GPT)
 */
export async function selectHookBias_gpt(articleText) {
  const prompt = `
  You are a senior cricket editor.
  
  From the article below, select the SINGLE most appropriate hook bias
  from this list ONLY:
  
  - pattern
  - implication
  - accountability
  - authority_opinion
  - role_system
  - expectation_management
  
  SELECTION RULES (STRICT):
  - authority_opinion → ONLY if a named individual makes a clear evaluative claim.
  - accountability → ONLY if explicit failure, scrutiny, deadlines, or consequences are stated.
  - pattern → When repetition, consistency, or long-term behavior is highlighted.
  - implication → When future impact or consequences matter more than the immediate event.
  
  HEADLINE SKEPTICISM RULE (CRITICAL):
  - Headlines may exaggerate or invent conflict.
  - NEVER infer pressure, scrutiny, leadership danger, or rivalry from the headline alone.
  - accountability is ALLOWED ONLY IF supported by:
    - direct quotes from selectors, coaches, captains, or officials, OR
    - explicit statements of failure, deadlines, or consequences in the article body.
  - If the headline suggests pressure terms such as:
    "danger", "under threat", "scrutiny", "in trouble", "faces pressure",
    but the article body does NOT explicitly support them,
    REJECT the headline framing completely.
  
  DEFAULT BEHAVIOR:
  - If pressure is NOT explicitly supported,
    default to pattern or implication.
  - Focus on mindset, behavior, repetition, outcomes, or observable trends.
  - DO NOT invent leadership battles, scrutiny, or accountability narratives.
  
  OUTPUT RULE (ABSOLUTE):
  - Return ONLY the bias name.
  - No explanation.
  - No extra words or formatting.
  
  ARTICLE:
  ${articleText}
  `;

  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        { role: "system", content: "You are a precise classification engine." },
        { role: "user", content: prompt },
      ],
      max_tokens: 10,
    });

    return res.choices[0]?.message?.content?.trim();
  } catch (err) {
    console.error("GPT Hook Bias Error:", err);
    return "pattern"; // safe fallback
  }
}

/**
 * STEP 2: Tweet generation (GPT)
 */
export async function generateGPTCAtweet(articleText) {
  const systemInstruction = `
  You are a professional cricket analyst.
  Write neutral, factual summaries without opinion or analysis.
  
  FORMATTING RULE:
  - Write in plain text.
  - You may insert a single line break between sentences
    ONLY if it improves readability.
  - Do NOT split every sentence onto a new line.
  `;

  const userPrompt = `
  NEWS:
  ${articleText}
  
  TASK:
  Summarize the above news in a single factual summary of 2-3 paragraphs (240–300 characters).
  Focus only on key facts and context.
  Maintain a natural flow; must use a line break between the paragraphs.
  `;

  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.8,
      max_tokens: 160,
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: userPrompt },
      ],
    });

    const tweetText = res.choices[0]?.message?.content
      ?.replace(/\n[ \t]+/g, "\n")
      ?.replace(/\n{3,}/g, "\n\n")
      ?.trim();

    if (!tweetText) {
      console.warn("⚠️ Empty GPT tweet generated");
      return null;
    }

    return tweetText;
  } catch (err) {
    console.error("GPT Tweet Generation Error:", err);
    return null;
  }
}
