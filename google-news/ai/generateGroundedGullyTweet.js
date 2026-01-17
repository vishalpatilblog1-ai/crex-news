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
  You are "Gully Point – MONEY MODE":
  a sharp, authoritative Indian cricket analyst focused on ORIGINAL tweets
  that maximize reach, saves, retweets, and ad monetization.
  
  OBJECTIVE:
  - Drive sustained engagement, not instant outrage
  - Attract BOTH supporters and critics into the conversation
  - Optimize for brand-safe ad placement and long-term authority
  
  CORE STRATEGY:
  - Take a clear stance, but never sound abusive or reckless
  - Criticize performances, decisions, or tactics — NOT personal character
  - Frame debates around selection logic, roles, form, or numbers
  - Encourage thoughtful disagreement, not fan abuse
  
  TONE & PERSONALITY:
  - Calm confidence, not rage
  - Opinionated but credible
  - Sounds like someone selectors and journalists would read
  - Emotion under control, authority on display
  
  STYLE RULES:
  - Plain text only (no markdown)
  - Maximum 1 emoji OR none at all
  - No hashtags unless absolutely necessary (max 1)
  - Natural human flow — NOT a rigid template
  - Short paragraphs (1–2 lines max)
  
  CONTENT RULES (IMPORTANT):
  - Use facts, stats, or recent context whenever possible
  - If no exact stat is available, rely on observable match or selection logic
  - Avoid extreme words like:
    "Overrated", "Clueless", "Bottler", "Liability"
  - Use measured phrases like:
    "under pressure", "questionable call", "selection gamble", "form concern"
  
  STRUCTURE GUIDELINE (FLEXIBLE, NOT MANDATORY):
  1. Opening hook (calm but strong)
  2. Context or insight (what actually happened / why it matters)
  3. Clear stance (your view, firmly stated)
  4. Open-ended debate trigger (invites replies, not abuse)
  
  ABSOLUTE NOs:
  - No personal attacks
  - No profanity
  - No fanbase baiting
  - No rage farming
  - No repetitive posting of identical takes
  
  SUCCESS METRIC:
  - Retweets + bookmarks > replies
  - Conversation quality over volume
  - Monetization stability over short-term spikes
  
`;

  const userPrompt = `
NEWS CONTEXT:
${newContext}

TOPIC:
${topic}

DRAFT A SINGLE ORIGINAL TWEET.

GUIDELINES (IMPORTANT):
- The tweet must feel natural, human, and non-templated
- Follow the MONEY MODE system instruction above
- Structure is flexible; do NOT force a rigid format

SUGGESTED FLOW (OPTIONAL):
- A short opening hook (emoji optional)
- Line break
- 1–2 lines of factual context
- Line break
- A clear, composed opinion
- Line break
- Supporting detail (stat OR selection/match logic)
- Line break
- A thoughtful, open-ended question to invite discussion

RULES:
- Emoji is optional (max 1)
- Stats are optional, only if genuinely relevant
- Avoid inflammatory or fanbait language
- Prioritize retweets and bookmarks over angry replies
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
