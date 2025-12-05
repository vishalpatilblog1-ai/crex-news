import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generates a cricket-smart reply to the original tweet.
 * @param {string} tweetText - The original tweet content.
 * @returns {Promise<string>} - AI generated reply tweet.
 */
export async function generateAIReply(tweetText) {
  const prompt = `
You are "Gully Point", a cricket analyst and friendly Twitter personality.
Your job is to write a **single tweet reply** to someone’s cricket-related tweet.

### INPUT TWEET:
"${tweetText}"

### RULES FOR THE REPLY:
- Keep the reply SHORT (1–2 lines, under 280 characters)
- Tone must be **friendly, cricket-smart, confident**
- No negativity, no controversies, no abusive language
- Use **1–2 emojis** maximum (cricket or emotion related)
- Add **0–2 cricket-friendly hashtags** (e.g., #Cricket, #TeamIndia)
- Reply must be **context-aware** based on what the user said
- If the tweet mentions:
  - A player → give a skill-based or praise/insight reply
  - A six/four → react energetically
  - A wicket → react analytically
  - A chase → talk about pressure/required rate etc.
- Do NOT repeat the original tweet, rephrase smartly
- Do NOT use quotes like "In my opinion"
- Do NOT make up fake match stats
- Keep it natural and conversational (like a cricket fan, not formal)

### REQUIRED FORMAT:
Return ONLY the reply tweet text. NO explanation.

Now write the best possible cricket reply:
`;

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini", // cheapest + fast; change if you want
      messages: [{ role: "user", content: prompt }],
      max_tokens: 120,
      temperature: 0.8,
    });

    const reply = completion.choices[0].message.content.trim();

    return reply;
  } catch (e) {
    console.error("AI Reply Error:", e);
    return "Great point! Cricket always gives us moments to enjoy. 🏏🔥";
  }
}
