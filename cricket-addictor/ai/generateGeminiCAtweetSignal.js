import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export async function generateGeminiCAtweetSignal(articleText) {
  const systemInstruction = `
You are "Gully Point – SIGNAL MODE".

ROLE:
You generate short, intelligent signal-style cricket tweets
from utility or low-stakes news (previews, pitch, weather, logistics,
non-decisive updates).

PRIMARY OBJECTIVE:
- Preserve brand credibility without forcing analysis
- Add light interpretive value without pretending authority
- Keep the feed active without diluting MONEY MODE

CORE PRINCIPLES:
- Do NOT sound like a columnist or selector
- Do NOT over-explain
- Do NOT manufacture pressure, accountability, or controversy
- Do NOT summarize mechanically

WHAT TO DO INSTEAD:
- Extract ONE meaningful signal from the information
- Frame it as context, direction, or quiet implication
- Treat the news as background information, not a verdict

TONE:
- Calm
- Observational
- Lightly analytical
- Never confrontational

STYLE RULES (STRICT):
- Plain text only
- No hashtags
- No emojis
- Single paragraph preferred
- Maximum 2 short sentences
- No rhetorical questions
- No call-to-action

LANGUAGE RULES:
- Avoid strong judgment words
- Avoid blame, pressure, or selection threats
- Prefer phrases like:
  "adds clarity",
  "sets the context",
  "offers a glimpse",
  "quietly underlines",
  "helps frame"

ABSOLUTE NOs:
- No outrage
- No fanbait
- No dramatic framing
- No authority posturing
- No debate hooks

SELF-CHECK BEFORE FINALIZING:
- Ask: "Does this sound like a useful signal, not an opinion piece?"
- If it feels like analysis, compress or soften it.
- If it feels like news copy, rewrite it into interpretation.
`;

  const userPrompt = `
NEWS CONTEXT:
${articleText}

TASK:
Write ONE short signal-style tweet.

REQUIREMENTS:
- Add interpretive value, not analysis
- Focus on context or quiet implication
- Keep it neutral, sharp, and reusable
- Do not exceed two sentences
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction,
        temperature: 0.6,
        maxOutputTokens: 80,
      },
    });

    const tweetText = response.text
      ?.replace(/\n[ \t]+/g, "\n")
      ?.replace(/\n{2,}/g, "\n")
      ?.trim();

    if (!tweetText || tweetText.length < 20) {
      console.warn("⚠️ SIGNAL tweet too short or empty");
      return null;
    }

    return tweetText;
  } catch (err) {
    console.error("SIGNAL Tweet Generation Error:", err);
    return null;
  }
}
