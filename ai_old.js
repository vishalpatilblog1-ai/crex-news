import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
// ai.js (simple version – no AI needed)
export default function generateTweet(event) {
  const { type, batsman, bowler, runs, wickets, overs, team, choice } = event;

  // FOUR
  if (type === "FOUR") {
    return `${batsman} hits a four. Score: ${runs}/${wickets} in ${overs} overs.`;
  }

  // SIX
  if (type === "SIX") {
    return `${batsman} hits a six. Score: ${runs}/${wickets} in ${overs} overs.`;
  }

  // WICKET
  if (type === "WICKET") {
    return `Wicket. ${bowler} gets ${batsman}. Score: ${runs}/${wickets} in ${overs} overs.`;
  }

  // 50 milestone
  if (type === "FIFTY") {
    return `${batsman} reaches 50. Score: ${runs}/${wickets} in ${overs} overs.`;
  }

  // 100 milestone
  if (type === "HUNDRED") {
    return `${batsman} reaches 100. Score: ${runs}/${wickets} in ${overs} overs.`;
  }

  // LUNCH
  if (type === "LUNCH") {
    return `Lunch break. Score: ${runs}/${wickets} in ${overs} overs.`;
  }

  // TEA
  if (type === "TEA") {
    return `Tea break. Score: ${runs}/${wickets} in ${overs} overs.`;
  }

  // STUMPS
  if (type === "STUMPS") {
    return `Stumps. Score: ${runs}/${wickets} in ${overs} overs.`;
  }

  // TOSS
  if (type === "TOSS") {
    return `${team} wins the toss and chooses to ${choice}.`;
  }

  // fall back
  return `Score: ${runs}/${wickets} in ${overs} overs.`;
}


export default async function generateTweet_(eventData) {
  const prompt = `
You are a cricket commentator bot. Write a short, exciting tweet for this event:
${JSON.stringify(eventData)}

Rules:
- Add emojis
- Add 2-3 trending cricket hashtags
- Keep under 220 characters
- Write in a human style
  `;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });

  return response.choices[0].message.content.trim();
}
