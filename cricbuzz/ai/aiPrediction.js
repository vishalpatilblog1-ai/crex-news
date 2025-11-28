// aiPrediction.js
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Lightweight smart prediction generator
export async function generatePrediction({
  runs,
  wickets,
  overs,
  target,
  crr,
  rrr,
  battingTeam,
  bowlingTeam,
}) {
  const prompt = `
Give a short cricket match prediction in 1 sentence. 
Be concise and neutral. Under 15 words.

Data:
- Batting: ${battingTeam}
- Score: ${runs}/${wickets} in ${overs} overs
- Target: ${target}
- CRR: ${crr}
- RRR: ${rrr}
- Bowling: ${bowlingTeam}
`;

  try {
    const res = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 32,
      temperature: 0.7,
    });

    return res.choices[0].message.content.trim();
  } catch (e) {
    console.log("Prediction AI failed:", e.message);
    return ""; // fallback (no prediction)
  }
}
