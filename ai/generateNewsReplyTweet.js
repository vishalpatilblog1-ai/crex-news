// ai/generateNewsReplyTweet.js

import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateNewsReplyTweet(mainTweet) {
  if (!mainTweet || mainTweet.length < 50) {
    console.warn("⚠️ generateNewsReplyTweet skipped — mainTweet too short");
    return null;
  }
  const prompt = `
  You already wrote the main tweet in a cricket news thread.
  
  Now write ONE follow-up reply tweet that CONTINUES the same angle, tone, and argument of the main tweet.
  
  Rules:
  - 1 short paragraph
  - analytical
  - add one deeper layer, implication, or clarification
  - continue the same viewpoint as the main tweet
  - do NOT soften, neutralize, or generalize the main tweet
  - do NOT introduce a new angle that changes the tone
  - NO questions
  - do NOT end with a question
  - no hashtags
  - no emojis
  - plain text only
  - 70–140 characters preferred
  - do NOT repeat the main tweet wording
  - do NOT sound like a moral lesson, public service message, or neutral summary
  - the reply must feel like the same author continuing the same thread
  
  Main Tweet:
  ${mainTweet}
  `;

  try {
    const response = await client.responses.create({
      model: "gpt-4.1-mini", // fast + cheap for replies
      temperature: 0.7,
      max_output_tokens: 120,
      input: prompt,
    });

    const replyText = response.output_text?.trim();

    if (!replyText || replyText.length < 20) {
      console.warn("⚠️ GPT reply generation returned empty/short text");
      return null;
    }

    if (replyText.length > 280) {
      console.warn("⚠️ Reply exceeds tweet length:", replyText.length);
    }

    return replyText;
  } catch (err) {
    console.error("❌ GPT reply generation failed:", err);
    return null;
  }
}
