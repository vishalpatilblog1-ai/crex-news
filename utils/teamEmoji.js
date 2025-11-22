export function teamEmoji(teamName) {
  const name = teamName.toLowerCase();

  if (name.includes("india")) return "🇮🇳🔥";
  if (name.includes("south africa")) return "🟢⚡";
  if (name.includes("australia")) return "💛💥";
  if (name.includes("new zealand")) return "🖤🔥";
  if (name.includes("england")) return "🏴🔥";
  if (name.includes("pakistan")) return "🟢🌙";
  if (name.includes("sri lanka")) return "💙🦁";
  if (name.includes("bangladesh")) return "🟥🟩";
  if (name.includes("west indies")) return "🟣🔥";
  if (name.includes("afghanistan")) return "🔵🔥";
  if (name.includes("nepal")) return "🔷🔥";
  if (name.includes("uae")) return "⚪🔵";
  if (name.includes("ireland")) return "🍀⚡";
  if (name.includes("zimbabwe")) return "❤️💛";

  return "🏏"; // default emoji
}
