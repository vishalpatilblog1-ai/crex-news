// template.js
export function getFlagEmoji(teamShort) {
  if (!teamShort) return "";

  const map = {
    IND: "🇮🇳",
    INDW: "🇮🇳",
    INDU19: "🇮🇳",
    INDA: "🇮🇳",

    AUS: "🇦🇺",
    AUSW: "🇦🇺",
    AUSU19: "🇦🇺",
    AUSA: "🇦🇺",

    ENG: "🇬🇧",
    ENGW: "🇬🇧",
    ENGU19: "🇬🇧",
    ENGA: "🇬🇧",

    SA: "🇿🇦",
    RSA: "🇿🇦",
    SAW: "🇿🇦",
    SAU19: "🇿🇦",
    SAA: "🇿🇦",

    NZ: "🇳🇿",
    NZW: "🇳🇿",
    NZU19: "🇳🇿",
    NZA: "🇳🇿",

    PAK: "🇵🇰",
    PAKW: "🇵🇰",
    PAKU19: "🇵🇰",
    PAKA: "🇵🇰",

    SL: "🇱🇰",
    SLW: "🇱🇰",
    SLU19: "🇱🇰",
    SLA: "🇱🇰",

    BAN: "🇧🇩",
    BANW: "🇧🇩",
    BANU19: "🇧🇩",
    BANA: "🇧🇩",

    WI: "🇯🇲",
    WIW: "🇯🇲",
    WIU19: "🇯🇲",
    WIA: "🇯🇲",

    AFG: "🇦🇫",
    AFGW: "🇦🇫",
    AFGU19: "🇦🇫",

    IRE: "🇮🇪",
    IREW: "🇮🇪",
    IREU19: "🇮🇪",
    IREA: "🇮🇪",

    ZIM: "🇿🇼",
    ZIMW: "🇿🇼",
    ZIMU19: "🇿🇼",
    ZIMA: "🇿🇼",

    NEP: "🇳🇵",
    NEPW: "🇳🇵",
    NEPU19: "🇳🇵",

    NED: "🇳🇱",
    NEDW: "🇳🇱",
    NEDU19: "🇳🇱",

    SCO: "🏴",
    SCOW: "🏴",

    UAE: "🇦🇪",
    UAEW: "🇦🇪",
    UAEU19: "🇦🇪",

    USA: "🇺🇸",
    USAW: "🇺🇸",
    USAU19: "🇺🇸",

    THA: "🇹🇭",
    THAW: "🇹🇭",

    BTN: "🇧🇹",
    BTNW: "🇧🇹",

    BHR: "🇧🇭",
    BHRW: "🇧🇭",

    SLE: "🇸🇱",
    SLEW: "🇸🇱",

    RWA: "🇷🇼",
    RWAW: "🇷🇼",

    NGA: "🇳🇬",
    NGAW: "🇳🇬",

    ZAM: "🇿🇲",
    ZAMW: "🇿🇲",

    INA: "🇮🇩",
    INAW: "🇮🇩",

    MAS: "🇲🇾",
    MASW: "🇲🇾",

    PHL: "🇵🇭",
    PHLW: "🇵🇭",

    SIN: "🇸🇬",
    SINW: "🇸🇬",

    MYA: "🇲🇲",
    MYAW: "🇲🇲",

    MAL: "🇲🇼",
    MALW: "🇲🇼",

    ESP: "🇪🇸",
    ESPW: "🇪🇸",

    CRO: "🇭🇷",
    CROW: "🇭🇷",
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
