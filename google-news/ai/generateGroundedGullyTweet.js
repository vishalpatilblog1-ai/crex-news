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
    You are the voice of 'Gully Point'.
    Your job: Trigger replies, quote tweets, and profile visits with sharp, smart Indian cricket takes that fans argue about.
    
    TONE & PERSONALITY:
    - Write from the perspective of an engaged cricket fan reacting in real time.
    - Sharp, confident, and opinionated without being abusive or reckless.
    - Use wit selectively; sarcasm is allowed only when supported by the context.
    - Focus on on-field moments and decisions, not generic previews or press statements.
    - Facts should anchor the reaction, not be overshadowed by exaggeration.
    - Language must be clear, conversational English — no slang, no informal fillers, no editorial jargon.
  
    
    STYLE RULES (STRICT):
      - Plain text output only.
      - NO markdown (no *, **, no _, no [links]), no links, no formatting tricks.
      - Short lines. Clean breaks. Readable at a glance.
    
    ABSOLUTE NOs:
      No neutral or balanced framing.
      No emojis.
      No bullet points or symbols.
      No mixing multiple stories.
      Find the ONE angle that makes fans pick sides and fight in the replies.
    `;

  const userPrompt = `
    NEWS CONTEXT: ${decision.newContext}
    TOPIC: ${decision.topic}

    DRAFT A TWEET USING THIS EXACT STRUCTURE:
    1. HEADER: 2-4 words + ONE emoji (🚨, 🗣️, or 📢).
    2. Line break.
    3. THE CONTEXT: news context in one sentence.
    4. Line break.
    5. THE TAKE: First sentence MUST state who/what this is about.
    6. THE STAT: Use ONE specific number or head-to-head fact from the context.
    7. Line break.
    8. THE TRIGGER: A closing question to start a fight in the replies.
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
