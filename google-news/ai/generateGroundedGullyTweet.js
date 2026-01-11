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
    NEWS CONTEXT: ${decision.newContext}
    TOPIC: ${decision.topic}

    EMOJI USAGE RULE (STRICT):

    You may use ONLY ONE emoji, chosen strictly from ["🚨", "🗣️", "📢"].
    
    🚨 USE ONLY IF ALL CONDITIONS ARE TRUE:
    - The news is officially announced (board / government / league)
    - The decision has immediate impact
    - The information is time-sensitive (same-day relevance)
    
    Examples where 🚨 is allowed:
    - Ban announced
    - Emergency withdrawal
    - Rule enforced with instant effect
    
    DO NOT use 🚨 for:
    - Reactions
    - Fallout
    - Opinions
    - Fan anger
    - Analysis
    
    🗣️ USE FOR REACTIONS AND OUTRAGE:
    Use 🗣️ when the story focuses on:
    - Fan anger or public pushback
    - Player or stakeholder voices
    - Emotional or political reactions
    
    Examples:
    - Fans furious over a decision
    - Players speak out
    - Country reacts to a move
    
    🗣️ is the DEFAULT emoji for non-breaking controversies.
    
    📢 USE FOR STATEMENTS OR EXPLANATIONS:
    Use 📢 when:
    - An authority clarifies a decision
    - A board or official explains or defends a move
    - A stance or justification is issued
    
    Examples:
    - Board explanation
    - Official clarification
    - Media briefing
    
    📢 signals an announcement or positioning, NOT an emergency.

    TASK:
    Follow this structure EXACTLY:
    1. [HEADER} [${selectedHook} + 1-4 ALL CAPS WORDS] [${raondomEmojis}]
    2. (Line break)
    3. [The Hook: One-sentence high-emotion shock claim about the news]
    4. (Line break)
    5. [The Data: One sentence comparing stats or authority vs fans using hard numbers]
    6. (Line break)
    7. [The Question: A polarizing question forcing a choice between two players or ideas]

    HASHTAGS:
    - First hashtag MUST be #IPL2026
    - Second must be context-relevant
    - Exactly two total

    Example of desired format:
    RUTURAJ GAIKWAD HITS A MAIDEN ODI TON AND 15 LIST-A CENTURIES ONLY TO BE BENCHED FOR A NEWBIE. 🇮🇳

    Despite Rutu smashing 100s for fun and Sanju Samson carrying a 56+ ODI average, the selectors have handed Dhruv Jurel an ODI debut on a silver platter. 
    
    Jurel has 0 international experience in this format, yet he’s leapfrogged everyone to replace Rishabh Pant.
    
    Is the "Godfather" culture back in BCCI, or are they just blind to Rutu and Sanju’s dominance ?
    #IPL2026 #T20WorldCup
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
