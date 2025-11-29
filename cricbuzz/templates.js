// template.js
export function getFlagEmoji(teamShort) {
  if (!teamShort) return "";

  const map = {
    IND: "🇮🇳",
    AUS: "🇦🇺",
    ENG: "🇬🇧",
    SA: "🇿🇦",
    NZ: "🇳🇿",
    PAK: "",
    SL: "🇱🇰",
    BAN: "🇧🇩",
    IRE: "🇮🇪",
    AFG: "🇦🇫",
    WI: "🇯🇲",
    ZIM: "🇿🇼",
    NEP: "🇳🇵",
    NED: "🇳🇱",
    SCO: "🏴",
    UAE: "🇦🇪",
    USA: "🇺🇸",
  };

  return map[teamShort.toUpperCase()] || "";
}

// export function getEmojiPack(team, opponent) {
//   const t = team?.toLowerCase() || "";
//   const o = opponent?.toLowerCase() || "";

//   const isIndiaBatting = t.includes("india");
//   const isIndiaBowling = o.includes("india");

//   if (isIndiaBatting) {
//     return {
//       hit: ["🔥", "💥"],
//       wicket: ["🔴", "📛", "❌"],
//     };
//   }

//   if (isIndiaBowling) {
//     return {
//       hit: ["📛", "🔴"],
//       wicket: ["🟩", "✅"],
//     };
//   }

//   return {
//     hit: ["🔥", "💥"],
//     wicket: ["🔴", "📛"],
//   };
// }

export async function buildMatchResultTemplate(match, resultText) {
  const { team1Short, team2Short, format } = match;

  const headlines = [
    "🏆 Match Result",
    "🏁 Full Time",
    "🎉 Final Result",
    "📢 Match Over",
    "✨ Full-Time Update",
    "🔔 Final Whistle",
  ];

  const headline = headlines[Math.floor(Math.random() * headlines.length)];

  const emojis = ["🔥", "⭐", "💥", "👏", "🏏"];
  const symbol = emojis[Math.floor(Math.random() * emojis.length)];

  return `
  ${headline} ${symbol}
  
  ${resultText}
  
  #${match.team1Short} #${match.team2Short} #${match.format}
  `.trim();
}
