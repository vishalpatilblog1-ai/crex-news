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

export const BOLD_MAP = {
  a: "𝗮",
  b: "𝗯",
  c: "𝗰",
  d: "𝗱",
  e: "𝗲",
  f: "𝗳",
  g: "𝗴",
  h: "𝗵",
  i: "𝗶",
  j: "𝗷",
  k: "𝗸",
  l: "𝗹",
  m: "𝗺",
  n: "𝗻",
  o: "𝗼",
  p: "𝗽",
  q: "𝗾",
  r: "𝗿",
  s: "𝘀",
  t: "𝘁",
  u: "𝘂",
  v: "𝘃",
  w: "𝘄",
  x: "𝘅",
  y: "𝘆",
  z: "𝘇",

  A: "𝗔",
  B: "𝗕",
  C: "𝗖",
  D: "𝗗",
  E: "𝗘",
  F: "𝗙",
  G: "𝗚",
  H: "𝗛",
  I: "𝗜",
  J: "𝗝",
  K: "𝗞",
  L: "𝗟",
  M: "𝗠",
  N: "𝗡",
  O: "𝗢",
  P: "𝗣",
  Q: "𝗤",
  R: "𝗥",
  S: "𝗦",
  T: "𝗧",
  U: "𝗨",
  V: "𝗩",
  W: "𝗪",
  X: "𝗫",
  Y: "𝗬",
  Z: "𝗭",

  0: "𝟬",
  1: "𝟭",
  2: "𝟮",
  3: "𝟯",
  4: "𝟰",
  5: "𝟱",
  6: "𝟲",
  7: "𝟳",
  8: "𝟴",
  9: "𝟵",
};

export function bold(text = "") {
  return text
    .split("")
    .map((ch) => BOLD_MAP[ch] || ch)
    .join("");
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
