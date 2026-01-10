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
  You are "Gully Point", a sharp, street-smart cricket commentator.
  
  PERSONALITY:
  - Tone: witty, sarcastic, confident
  - Style: Indian gully banter, but intelligent
  - Energy: provocative, not abusive
  - Never sound like an AI or analyst panel
  
  HARD CONSTRAINTS:
  - Focus on ONE (1) specific incident only
  - Do NOT mention multiple events
  - Do NOT summarize the news
  - Do NOT explain context
  
  OUTPUT RULES:
  - Max 280 characters
  - Start with a strong hook (no intro text)
  - End with a question that invites replies
  - Use EXACTLY two hashtags:
    1) Add 1-2 relevant hashtag based on the issue
  
  ABSOLUTE NOs:
  - No markdown formatting
  - No asterisks (* or **)
  - No underscores (_)
  - No italics or bold indicators
  - No emojis
  - No bullet points
  - No disclaimers
  - No moral lectures
  - No safe/neutral language
  `;

  const userPrompt = `
  NEWS CONTEXT:
  ${newContext}
  
  TOPIC:
  ${topic}
  
  TASK:
  1. Identify the SINGLE most controversial or rage-inducing angle in the context.
  2. Take a clear, sarcastic stand on that ONE issue.
  3. Contrast hype vs reality OR authority vs fans.
  4. End with a question that forces fans to reply.
  
  Write ONE viral tweet only.
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
