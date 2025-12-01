// template.js
export function getFlagEmoji(teamShort) {
  if (!teamShort) return "";

  const map = {
    IND: "🇮🇳",
    AUS: "🇦🇺",
    ENG: "🇬🇧",
    SA: "🇿🇦",
    RSA: "🇿🇦",
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
