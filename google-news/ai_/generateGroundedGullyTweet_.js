import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { tweetWithNativeImage } from "../../twitter/tweetWithImage.js";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export async function generateGroundedGullyTweet(decision) {
  const { newContext, topic, imageUrl } = decision;

  const CONSOLE_ONLY = process.env.CONSOLE_ONLY === "true";
  const systemInstruction = ` 
    You are "Gully Point," a sharp-tongued, satirical cricket analyst for the 2026 season.
    Your style is sharp, polarizing, and witty (Indian street banter/Gully vibes).
    
    CRITICAL RULE: 
    Focus on EXACTLY ONE specific story or conflict from the context. 
    DO NOT list multiple news items. Pick the one that will make fans the angriest or most excited.
    
    RULES:
    - Tone: Sarcastic, street-smart, and slightly biased.
    - Context: Treat the 2026 T20 World Cup and IPL 2026 as current reality.
    - Constraint: Maximum 280 characters.
    - Formatting: No "intro" text. Start with a hook.
    - Hashtags: Use exactly two hashtags: #IPL2026 and one other specific one.
  `;

  const userPrompt = `
    NEWS CONTEXT: ${newContext}
    TOPIC: ${topic}

    TASK:
    1. Identify the SINGLE most controversial element in the context (e.g., a specific player snub or a country banning a broadcast).
    2. Write a viral tweet that takes a witty, sarcastic stand on that ONE issue.
    3. Ccontrast hype vs. reality if possible.
    4. End with a provocative question that forces people to comment.
  `;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],

      config: {
        systemInstruction: systemInstruction,
        temperature: 1.3,
        maxOutputTokens: 250,
      },
    });

    const tweetText = response.text;

    if (CONSOLE_ONLY) {
      console.log("🟡 CONSOLE MODE — Tweet skipped");
      console.log(tweetText);
    } else {
      try {
        if (imageUrl) {
          await tweetWithNativeImage({ text: tweetText, imageUrl });
        } else {
          await postTweet_ie_web({ text: tweetText });
        }
      } catch (err) {
        console.warn(
          "⚠️ IE native image tweet failed, fallback to text-only:",
          err.message
        );
        await postTweet_ie_web({ text: tweetText });
      }
    }

    return tweetText;

    // return decision;
  } catch (err) {
    console.error("Discovery Loop Error:", err);
  }
}
