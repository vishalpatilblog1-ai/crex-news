import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function generateTweet(matchContext) {
  if (
    !matchContext?.ball?.eventtype ||
    matchContext.ball.eventtype === "NONE"
  ) {
    return "SKIP";
  }
  try {
    const prompt = `
You will get a single object called matchContext (NOT a string literal).
Use ONLY matchContext fields. DO NOT hallucinate player runs or missing stats.

Here is the object:
${JSON.stringify(matchContext, null, 2)}

=====================
STRICT TWEET RULES
=====================

1. Use matchContext.ball.eventtype to decide which tweet to generate.
2. Use matchContext.ball.text to describe the event description - refer OUTPUT FORMAT TEMPLATES 
   rule for it - event description means I am refering the line <Main headline line> in that OUTPUT FORMAT
3. If the events are for lunch break, drinks break, innings break, stumps, tea breaks 
   then refer matchContext.match.status for event description - - refer OUTPUT FORMAT TEMPLATES 
   rule for it - event description means I am refering the line <Main headline line> in that OUTPUT FORMAT
4. for total runs refer - matchContext.innings.runs
5. for total wickets refer - matchContext.innings.wickets
6. for total overs refer - matchContext.innings.overs
7. for match title refer - matchContext.match.name
8. for format refer - matchContext.match.format
9. for team1 - refer  matchContext.match.team1
10. for team1 - refer  matchContext.match.team2



EVENT TYPES EXAMPLES:
SIX
FOUR
WICKET
FIFTY
HUNDRED
TEAM_FIFTY
TEAM_HUNDRED
PARTNERSHIP_50
PARTNERSHIP_100
DRINKS
LUNCH
TEA
STUMPS
INNINGS_BREAK
NONE → respond “SKIP”

=====================
EMOJI RULES
=====================
- India positive: 🇮🇳🔥🙌💥✨
- Opponent positive: 🙂📈
- India loses wicket: NO EMOJI
- India takes wicket: 🔥

=====================
OUTPUT FORMAT
=====================

Always print EXACTLY like this:

🚨 MATCH <TEAM1> VS <TEAM2> <FORMAT> UPDATE 🚨

<Main headline line>

<RUNS>/<WICKETS> (<matchContext.innings.overs> Overs)
<Striker> : <matchContext.players.strikerRuns> (matchContext.players.strikerBallsPlayed)
<Non-striker> : <matchContext.players.nonStrikerRuns> (matchContext.players.nonStrikerBallsPlayed)

<Trail/Lead text>

=====================
HOW TO DETERMINE INDIA POSITIVE?
=====================
matchContext.innings.battingTeam:
- If “IND” → India batting
- If “RSA” and event is SIX → opponent positive etc.

=====================
EVENT TEMPLATES
=====================

1️⃣ SIX (India positive)
"SIX event type description based on <matchContext.ball.text>. 🇮🇳🔥"

2️⃣ SIX (opponent positive)
"SIX event type description based on <matchContext.ball.text>. 🙂"

3️⃣ FOUR (India positive)
"FOUR event type description based on <matchContext.ball.text>. ✨"

4️⃣ FOUR (opponent positive)
"FOUR event type description based on <matchContext.ball.text>. 📈"

5️⃣ WICKET – India loses wicket
"WICKET event type description based on <matchContext.ball.text>."

6️⃣ WICKET – India takes wicket
"WICKET event type description based on <matchContext.ball.text>. 🔥"

7️⃣ BATTER FIFTY
"FIFTY event type description based on <matchContext.ball.text>. 🙌"

8️⃣ BATTER HUNDRED
"CENTURY event type description based on <matchContext.ball.text>. 💥"

9️⃣ TEAM FIFTY
"<team> event type description based on <matchContext.ball.text>. 📈"

10️⃣ TEAM HUNDRED
"<team> event type description based on <matchContext.ball.text>. 💪"

11️⃣ PARTNERSHIP 50
"Fifty-run stand between <striker> & <nonStriker>. 🤝"

12️⃣ PARTNERSHIP 100
"Century stand! <striker> & <nonStriker> solid. 🤝"

13️⃣ DRINKS
"Drinks Break: <matchContext.match.status>"

14️⃣ LUNCH
"Lunch Break: <matchContext.match.status>"

15️⃣ TEA
"Tea Break: <matchContext.match.status>"

16️⃣ STUMPS
"Stumps: <matchContext.match.status>"

17️⃣ INNINGS BREAK
"Innings Break: <matchContext.match.status>"



Now generate the tweet.
Make it clean and EXACTLY in the above structure.
Never guess scores or player runs.
If data is missing → omit that line.
    `;

    const response = await client.chat.completions.create({
      model: "gpt-4.1",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    });

    return response.choices[0].message.content.trim();
  } catch (err) {
    console.error("AI ERROR:", err);
    return "SKIP";
  }
}
