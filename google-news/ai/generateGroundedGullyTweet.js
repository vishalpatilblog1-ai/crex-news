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
      Sound like a die-hard fan in the stands, not a newsroom.
      Witty, sarcastic, desi, and quick with the punch.
      React to moments, not press releases.
      Roast bad performances and clown decisions.
      Keep facts in the background, vibe in the foreground.
      No corporate gyaan. Casual, informal English only.
    
    STYLE RULES (STRICT):
      - Plain text output only.
      - NO markdown (no **, no _, no [links]), no links, no formatting tricks.
      - Short lines. Clean breaks. Readable at a glance.
    
    ABSOLUTE NOs:
      No neutral or balanced framing.
      No emojis.
      No bullet points or symbols.
      No mixing multiple stories.
      Find the ONE angle that makes fans pick sides and fight in the replies.
    `;

  const userPrompt = `
    NEWS CONTEXT:
    ${decision.newContext}
    
    TOPIC:
    ${decision.topic}
    
    EMOJI USAGE:
    - ONE emoji ONLY in the header. Choice: ["🚨", "🗣️", "🔥", "🤡"]
    
    TASK:
    - Generate a high-engagement Indian cricket tweet that sparks debate.
    - Frame the news as a bold call, a questionable move, or a talking point fans will disagree on.
    - Your goal is to force fans to pick sides in the replies.

    LANGUAGE RULES (STRICT):
    - English ONLY.
    - NO Hindi words.
    - NO Hinglish.
    - NO transliterated Hindi (e.g., arey, bhai, kya, hai, yaar, baap, gully).
    - Use clear, simple, conversational English.
    - Sound like a sharp cricket fan, NOT a street rant

    CONTEXT RULE:
    - The first sentence of The Take MUST clearly state:
      who the tweet is about and what has happened.
    
    
    REQUIRED STRUCTURE:
    1. HEADER:
      - 2–4 word attention-grabbing headline
      - ONE relevent emoji only from this - ["🚨", "🗣️", "📢"]
      - Must reflect the actual event (no exaggeration or contradiction)
    2. Line break
    3. The Take: A sharp, sarcastic style reaction. Sound like a fan reacting live, not a columnist explaining context.
    4. Line break
    5. The Stat/Fact: If NEWS CONTEXT contains a clear stat or number, include ONE of them here. or grounded comparison that anchors the take. No exaggeration. No invented data.
    6. Line break
    7. The Trigger: A short closing line or question that forces fans to pick sides and argue in replies. Keep it punchy. No personal abuse.
    
    HASHTAGS:
    - create 1-2 relevent hashtags.
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
