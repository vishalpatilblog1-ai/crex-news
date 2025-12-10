// template.js
import {
  BOLD_ITALIC_MAP,
  BOLD_MAP,
  FLAG_MAP,
  ITALIC_MAP,
} from "./templates/textStyles.js";

export function getFlagEmoji(teamShort) {
  if (!teamShort) return "";

  return FLAG_MAP[teamShort.toUpperCase()] || "";
}

export function bold(text = "") {
  return text
    .split("")
    .map((ch) => BOLD_MAP[ch] || ch)
    .join("");
}

export function italic(text = "") {
  return text
    .split("")
    .map((ch) => ITALIC_MAP[ch] || ch)
    .join("");
}

export function boldItalic(text = "") {
  return text
    .split("")
    .map((ch) => BOLD_ITALIC_MAP[ch] || ch)
    .join("");
}

// export async function buildMatchResultTemplate(match, resultText) {
//   const { team1Short, team2Short, format } = match;

//   const headlines = [
//     "🏆 Match Result",
//     "🏁 Full Time",
//     "🎉 Final Result",
//     "📢 Match Over",
//     "✨ Full-Time Update",
//     "🔔 Final Whistle",
//   ];

//   const headline = headlines[Math.floor(Math.random() * headlines.length)];

//   const emojis = ["🔥", "⭐", "💥", "👏", "🏏"];
//   const symbol = emojis[Math.floor(Math.random() * emojis.length)];

//   return `
//   ${headline} ${symbol}

//   ${resultText}

//   #${match.team1Short} #${match.team2Short} #${match.format}
//   `.trim();
// }
