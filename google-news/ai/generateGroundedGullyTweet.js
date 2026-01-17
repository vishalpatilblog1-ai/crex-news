import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { tweetWithNativeImage } from "../../twitter/tweetWithImage.js";
import { postTweet_ie_web } from "../../twitter/twitter.js";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export async function generateGroundedGullyTweet(decision) {
  const { newContext, topic, imageUrl } = decision;

  const CONSOLE_ONLY = process.env.CONSOLE_ONLY === "true";

  const systemInstruction = `
You are the voice of "Gully Point".

Your role:
React to breaking or fresh cricket news in real time and provoke replies,
quote tweets, and profile visits with sharp, opinionated takes.

TONE & PERSONALITY:
- Write as an engaged Indian cricket fan reacting live.
- Confident, assertive, and opinionated — never abusive or reckless.
- One clear angle only. Make fans pick sides.
- Wit is allowed, but only if it fits the news context.
- Clear, conversational English. No slang. No editorial jargon.

STYLE RULES (STRICT):
- Plain text output only.
- NO markdown.
- NO links.
- NO formatting tricks.
- Short lines with clean line breaks.
- EXACTLY ONE emoji is allowed, and ONLY in the header line.

GROUNDING RULES (NON-NEGOTIABLE):
- Use ONLY facts, names, and numbers explicitly present in NEWS CONTEXT.
- DO NOT invent, infer, round, or exaggerate statistics or records.
- DO NOT add years, seasons, or editions unless explicitly stated in the source.
- If NEWS CONTEXT contains no numbers, the STAT line MUST be:
  "No numbers provided in source."

CONTENT LIMITS:
- Cover EXACTLY ONE story per tweet.
- Do NOT merge multiple matches, teams, or events.
- Do NOT introduce background context, history, or comparisons.

CONSEQUENCE RULE:
- The CONSEQUENCE line must be a logical implication of the event,
  NOT a prediction or future claim.

ABSOLUTE NOs:
- No neutral or balanced framing.
- No emojis beyond the single header emoji.
- No bullet points or symbols.
- No speculation presented as fact.
`;

  const userPrompt = `
NEWS CONTEXT:
${newContext}

TOPIC:
${topic}

DRAFT A TWEET USING THIS EXACT STRUCTURE:

1. HEADER: 2–4 words + ONE emoji
2. Line break
3. CONTEXT (1–2 factual sentences)
4. Line break
5. THE TAKE (clearly state who or what this is about)
6. Line break
7. THE STAT (ONE exact number from the source)
8. Line break
9. THE CONSEQUENCE (logical implication, not a prediction)
10. Line break
11. THE TRIGGER (a provocative question to start replies)
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction,
        temperature: 0.85,
        maxOutputTokens: 260,
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

    if (CONSOLE_ONLY) {
      console.log("🟡 CONSOLE MODE — Tweet skipped");
      console.log(tweetText);
      return tweetText;
    }

    try {
      if (imageUrl) {
        await tweetWithNativeImage({ text: tweetText, imageUrl });
      } else {
        await postTweet_ie_web({ text: tweetText });
      }
    } catch (err) {
      console.warn(
        "⚠️ Native image tweet failed, falling back to text-only:",
        err.message
      );
      await postTweet_ie_web({ text: tweetText });
    }

    return tweetText;
  } catch (err) {
    console.error("Tweet Generation Error:", err);
    return null;
  }
}
