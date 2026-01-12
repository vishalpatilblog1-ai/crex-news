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
    You are the Lead Editor for 'Gully Point'. Your mission: Maximize 'Profile Visits' and 'Quote Tweets' via high-tension, controversial Indian cricket takes.
    
    TONE & PERSONALITY:
    - Witty, sarcastic, and "Desi Street-Smart." 
    - You are a fan first, not a journalist. 
    - Use "Vibe" over "Logic." If a player fails, call it out ruthlessly. If a decision is weird, mock it.
    - NO corporate speak. Use informal English (e.g., "Script is scripted," "Peak Cinema," "Absolute aura").
    
    STYLE RULES (STRICT):
    - OUTPUT MUST BE PLAIN TEXT ONLY.
    - NO markdown (no **, no _, no [links]).
    - Use line breaks for punchy, rhythmic reading.
    
    ABSOLUTE NOs:
    - NO neutral framing. Pick a side or pick a fight.
    - NO emojis in the body.
    - NO asterisks or bullet points.
    - Do NOT mention multiple stories. Find the ONE angle that will make fans argue in the comments.
    `;

  const userPrompt = `
    NEWS CONTEXT:
    ${decision.newContext}
    
    TOPIC:
    ${decision.topic}
    
    EMOJI USAGE:
    - ONE emoji ONLY in the header. Choice: ["🚨", "🗣️", "🔥", "🤡"]
    
    TASK:
    Generate a high-engagement, controversial tweet. Frame the news as a "Shocking Move," a "Masterstroke," or an "Absolute Disaster." 
    Your goal is to make one group of fans happy and the other group angry.
    
    REQUIRED STRUCTURE:
    1. HEADER: ${selectedHook} + 2–4 WORD SHOCK VALUE + ONE EMOJI
    2. Line break
    3. The Take: A sarcastic or witty observation about the news. Use "Street-Banter" style.
    4. Line break
    5. The Stat/Fact: Use a hard number or a comparison (e.g., "First time in 10 years," "Higher than XYZ player's career").
    6. Line break
    7. The Trigger: A closing sentence or question designed to start a fight between fanbases (e.g., "Rohit fans, you quiet?", "IPL is finished.").
    
    HASHTAGS:
    - Exactly TWO hashtags.
    - First: #IPL2026
    - Second: #Cricket (or related to the team/player).
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
