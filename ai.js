import OpenAI from "openai";
import dotenv from "dotenv";
import {
  cleanBallText,
  formatPartnership,
  shortTeamName,
  smartShortName,
} from "./utils/formatter.js";

dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
function generateHashtag(match) {
  const t1 = shortTeamName(match.team1);
  const t2 = shortTeamName(match.team2);

  if (t1 === "IND" || t2 === "IND") {
    const other = t1 === "IND" ? t2 : t1;
    return `#INDvs${other}`;
  }

  return `#${t1}vs${t2}`;
}

export async function generateHeadline(ballText) {
  const styleMode = Math.floor(Math.random() * 12);
  try {
    const prompt = `
Rewrite the cricket ball commentary into a headline. 
Use the style based on this number: ${styleMode}

HEADLINE STYLE MODES:
0 – Simple, neutral headline  
1 – Aggressive short punchline 🔥  
2 – Calm & journalistic  
3 – Fan-style 🇮🇳 tone  
4 – Ultra-short minimal (3–6 words)  
5 – Hinglish flavour (cricket-fan style)  
6 – Emoji-heavy style (max 2 emojis)  
7 – Commentary-style exclamation (“What a shot!”)  
8 – Tamil mass-tone (Vera Level, Semma, Mass da)  
9 – Punjabi hype-tone (Vaddeya Shot, Gabru Shot)  
10 – Kannada energy-tone (Bharjari, Boss Shot, Masth)  
11 – Telugu mass-tone (Adiripoyadu, Mass Ga Maaradu, Thaggedhe Le)

STRICT RULES:
- Do NOT add scores, strike rates, or stats.
- Do NOT guess or add new player names.
- Use ONLY the players already present in the text.
- If the action is POSITIVE for India:
    • India batter hits FOUR → add 🔥  
    • India batter hits SIX → add 💥  
    • India bowler takes a wicket → add 🟢  
- If the action is NEGATIVE for India:
    • India loses a wicket → add 🔴
- If NOT related to India, add NO emoji.
- Do NOT add analysis.
- Keep it short and clean.

Ball Text:
"${ballText}"

Output ONLY the headline.
`;

    const res = await client.chat.completions.create({
      model: "gpt-4.1",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6,
    });

    // return res.choices[0].message.content.trim();
    return res.choices[0].message.content.trim().toUpperCase();
  } catch (err) {
    console.error("HEADLINE AI ERROR:", err);
    return "";
  }
}

export default async function generateTweet(matchContext) {
  try {
    if (!matchContext?.ball?.eventtype) return "SKIP";

    const event = matchContext.ball.eventtype.toUpperCase();
    const cleanText = cleanBallText(matchContext.ball.text);

    const { innings, players, match } = matchContext;

    if (event === "NONE") return "SKIP";
    if (event === "OVER-BREAK" || event === "over-break") return "SKIP";

    if (!cleanText || cleanText.length < 5) return "SKIP";

    const battingFullName = match.team1
      .toLowerCase()
      .includes(innings.battingTeam.toLowerCase())
      ? match.team1
      : match.team2;

    let parts = [];

    const header = `🚨 ${shortTeamName(match.team1)} vs ${shortTeamName(
      match.team2
    )} ${match.format} Updates 🚨`;

    const headline = await generateHeadline(cleanText);

    const scoreLine = `${battingFullName} - ${innings.runs}/${innings.wickets} (${innings.overs} Overs)`;

    const strikerName = smartShortName(players.striker, players.nonStriker);
    const nonStrikerName = smartShortName(players.nonStriker, players.striker);

    const strikerLine =
      strikerName && players.strikerRuns && players.strikerBallsPlayed
        ? `${strikerName}: ${players.strikerRuns} (${players.strikerBallsPlayed})`
        : "";

    const nonStrikerLine =
      nonStrikerName && players.nonStrikerRuns && players.nonStrikerBallsPlayed
        ? `${nonStrikerName}: ${players.nonStrikerRuns} (${players.nonStrikerBallsPlayed})`
        : "";

    parts.push(header);
    parts.push("");
    parts.push(headline);
    parts.push("");
    parts.push(scoreLine);
    parts.push("");

    if (strikerLine) parts.push(strikerLine);
    if (nonStrikerLine) parts.push(nonStrikerLine);

    const canShowPartnership =
      players.striker &&
      players.nonStriker &&
      players.strikerRuns &&
      players.nonStrikerRuns &&
      players.strikerBallsPlayed &&
      players.nonStrikerBallsPlayed &&
      matchContext.ball.partnership;

    if (canShowPartnership) {
      const formattedPartnership = formatPartnership(
        matchContext.ball.partnership
      );
      parts.push(`Partnership: ${formattedPartnership}`);
      parts.push("");
    }

    // below line is commented temporary
    // if (innings.trailOrLeadText) parts.push(innings.trailOrLeadText);

    while (parts.length > 0 && parts[parts.length - 1].trim() === "") {
      parts.pop();
    }

    parts.push("");
    parts.push(generateHashtag(match));

    return parts.join("\n").trim();
  } catch (err) {
    console.error("AI ERROR:", err);
    return "SKIP";
  }
}
