import dotenv from "dotenv";
dotenv.config();
import OpenAI from "openai";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const PREVIOUS_REPLIES_LIMIT = 50;
let lastReplies = [];

export async function generateSmartReply(tweetText) {
  try {
    const prompt = `
You are a cricket social media expert.

TASK:
1. Classify the tweet into one category:
   NEWS, PERFORMANCE, OPINION, HIGHLIGHT, INTERVIEW, STAT, MEDIA.
2. Write a short (max 18 words), positive, non-controversial, brand-safe reply.
3. Avoid repeating common phrases like:
   - "exciting times"
   - "thrilling"
   - "great to see"
4. NEVER criticize players, boards, umpires, countries, or teams.
5. Use variations in tone so replies feel natural.
6. Do NOT use hashtags.

Tweet:
"${tweetText}"

Generate ONLY the reply.
`;

    const result = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.55,
    });

    let reply = result.choices[0].message.content.trim();

    // Avoid repeating old replies
    if (lastReplies.includes(reply)) {
      reply += " 👏"; // slight variation
    }

    lastReplies.push(reply);
    if (lastReplies.length > PREVIOUS_REPLIES_LIMIT) {
      lastReplies.shift();
    }

    return reply;
  } catch (err) {
    console.error("AI error:", err);
    return "Great cricket insight! Thanks for sharing. 🏏";
  }
}
