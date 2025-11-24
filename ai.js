import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/* CLEAN COMMENTARY TEXT */
function cleanBallText(text) {
  if (!text) return "";
  return text
    .replace(/B\d\$/g, "") // remove B0$, B1$
    .replace(/\s+/g, " ") // normalize spacing
    .trim();
}

export default async function generateTweet(ctx) {
  try {
    // Safety
    if (!ctx?.ball?.eventtype) return "SKIP";

    const event = ctx.ball.eventtype.toUpperCase();
    const cleanText = cleanBallText(ctx.ball.text);

    // Hard skip normal balls
    if (event === "NONE") return "SKIP";
    if (event === "over-break") return "SKIP";
    if (!cleanText || cleanText.length < 5) return "SKIP";

    const { innings, players, match } = ctx;

    const scoreLine = `${innings.runs}/${innings.wickets} (${innings.overs} Overs)`;

    const strikerLine =
      players?.striker && players?.strikerRuns && players?.strikerBallsPlayed
        ? `${players.striker} : ${players.strikerRuns} (${players.strikerBallsPlayed})`
        : "";

    const nonStrikerLine =
      players?.nonStriker &&
      players?.nonStrikerRuns &&
      players?.nonStrikerBallsPlayed
        ? `${players.nonStriker} : ${players.nonStrikerRuns} (${players.nonStrikerBallsPlayed})`
        : "";

    let headline = "";

    // Determine who is batting
    const indiaBatting = (innings?.battingTeam || "")
      .toUpperCase()
      .includes("IND");

    // ==========================================
    // EVENT LOGIC (ONLY EVENT HEADLINE HERE)
    // ==========================================

    switch (event) {
      case "SIX":
        headline = indiaBatting
          ? `💥 SIX! ${cleanText} 🇮🇳🔥`
          : `SIX by opponent: ${cleanText} 📈`;
        break;

      case "FOUR":
        headline = indiaBatting
          ? `FOUR! ${cleanText} ✨🇮🇳`
          : `FOUR for opponent: ${cleanText} 📈`;
        break;

      case "WICKET":
        headline = indiaBatting
          ? `${cleanText}` // India loses wicket → no emoji
          : `WICKET! ${cleanText} 🔥`; // India takes wicket
        break;

      case "FIFTY":
        headline = `FIFTY! ${cleanText} 🙌`;
        break;

      case "HUNDRED":
      case "CENTURY":
        headline = `CENTURY! ${cleanText} 💥`;
        break;

      case "TEAM_FIFTY":
        headline = `Team reaches 50! ${cleanText} 📈`;
        break;

      case "TEAM_HUNDRED":
        headline = `Team crosses 100! ${cleanText} 💪`;
        break;

      case "PARTNERSHIP_50":
        headline = `50-run partnership! 🤝`;
        break;

      case "PARTNERSHIP_100":
        headline = `Century stand! 🤝`;
        break;

      case "DRINKS":
        headline = `Drinks Break — ${match.status}`;
        break;

      case "LUNCH":
        headline = `Lunch Break — ${match.status}`;
        break;

      case "TEA":
        headline = `Tea Break — ${match.status}`;
        break;

      case "STUMPS":
        headline = `Stumps — ${match.status}`;
        break;

      case "INNINGS_BREAK":
        headline = `Innings Break — ${match.status}`;
        break;

      default:
        return "SKIP"; // Unknown event
    }

    // ==========================================
    // FINAL TWEET FORMAT
    // ==========================================
    let tweet = `
🚨 MATCH ${match.team1} VS ${match.team2} ${match.format} UPDATE 🚨

${headline}

${scoreLine}
${strikerLine}
${nonStrikerLine}

${innings.trailOrLeadText}
    `.trim();

    return tweet;
  } catch (err) {
    console.error("AI ERROR:", err);
    return "SKIP";
  }
}
