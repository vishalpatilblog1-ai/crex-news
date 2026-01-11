import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { tweetWithNativeImage } from "../../twitter/tweetWithImage.js";
import { postTweet_ie_web } from "../../twitter/twitter.js";
import { randomHooks, raondomEmojis } from "../utils.js";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export async function generateGroundedGullyTweet(decision) {
  const { newContext, topic, imageUrl } = decision;

  const CONSOLE_ONLY = process.env.CONSOLE_ONLY === "true";

  const selectedHook =
    randomHooks[Math.floor(Math.random() * randomHooks.length)];

  const systemInstruction = `
    You are the Lead Editor for 'Gully Point'. Your mission: Maximize 'Detail Expands' and 'Profile Visits' via controversial 2026 cricket takes.
    
    STYLE RULES:
    - NO MARKDOWN: Use PLAIN TEXT only. No bold (**) or italics.
    - STRUCTURE: You MUST use line breaks between the header, the body, and the closer.
    - DATA:
        - If stats exist, use exact numbers.
        - If not, use authority vs fans contrast (decision count, years, matches, votes).
        - NEVER invent numbers.
    - TONE: Witty, sarcastic Indian street-banter. No corporate speak.
    
    ABSOLUTE NOs:
    - No asterisks (*), No underscores (_), No bullet points (- or •).
    - Do NOT mention multiple news stories. Pick the ONE most rage-inducing angle.
  `;

  const userPrompt = `
  NEWS CONTEXT:
  ${decision.newContext}
  
  TOPIC:
  ${decision.topic}
  
  EMOJI USAGE RULE (STRICT):
  - You may use ONLY ONE emoji
  - Emoji must be chosen from ["🚨", "🗣️", "📢"]
  - Emoji may appear ONLY in the HEADER
  - Do NOT use emojis anywhere else
  
  TASK:
  Generate a neutral but engaging international cricket tweet.
  Frame the issue as a debated decision, policy question, or unresolved situation.
  Focus on implications, not emotions.
  Do NOT take sides.
  
  REQUIRED STRUCTURE:
  1. HEADER: ${selectedHook} + 2–4 ALL CAPS WORDS + ONE EMOJI
  2. Line break
  3. Context line: a factual summary of what has happened or been decided
  4. Line break
  5. Impact line: why this matters for international cricket, teams, or players
  6. Line break
  7. Closing question: an open-ended analytical question (not A vs B outrage)
  
  STYLE RULES:
  - Plain text only
  - NO asterisks (*), NO underscores (_), NO markdown
  - Emphasis ONLY via CAPITAL LETTERS (max 2–4 words)
  - Calm, analytical, newsroom-style tone
  
  SAFETY RULES (MANDATORY):
  - Do NOT imply pressure, coercion, or hidden intent
  - Do NOT frame speculation as certainty
  - Do NOT use emotive or nationalistic language
  
  HASHTAGS:
  - Exactly TWO hashtags
  - First hashtag MUST be #IPL2026
  - Second must be internationally relevant (e.g., #Cricket, #ICC, #T20WorldCup)
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

    const tweetText = response.text
      .replace(/\n[ \t]+/g, "\n") // remove leading spaces after newlines
      .replace(/\n{3,}/g, "\n\n") // max two line breaks
      .trim();

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
