//generateGeminiCAtweet.js
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export async function selectHookBias(articleText) {
  const prompt = `
You are a senior cricket editor.

From the following article, choose the SINGLE most appropriate hook bias
from this list ONLY:

- pattern
- implication
- accountability
- authority_opinion
- role_system
- expectation_management

Rules:
- Choose authority_opinion if a named individual makes a strong claim.
- Choose accountability ONLY if failure or scrutiny is explicit.
- Choose pattern if repetition or consistency is highlighted.
- Choose implication if consequences matter more than performance.

Return ONLY the bias name. No explanation.

ARTICLE:
${articleText}
`;

  const res = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { temperature: 0 },
  });

  return res.text.trim();
}

export async function generateGeminiCAtweet(articleText) {
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
  Summarize the above news in a single factual summary of 2-3 paragraphs (240–320 characters).
  Focus only on key facts and context.
  Maintain a natural flow; must use a line break between the paragraphs.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction,
        temperature: 0.8,
        maxOutputTokens: 160,
      },
    });

    const tweetText = response.text
      .replace(/\n[ \t]+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (!tweetText) {
      console.warn("⚠️ Empty tweet generated");
      return null;
    }

    return tweetText;
  } catch (err) {
    console.error("Tweet Generation Error:", err);
    return null;
  }
}
