// template.js
// -----------------------------------------------
export function getEmojiPack(team, opponent) {
  const t = team?.toLowerCase() || "";
  const o = opponent?.toLowerCase() || "";

  if (t.includes("india")) {
    return {
      hit: ["🇮🇳🔥", "🇮🇳💥", "🇮🇳👏", "🇮🇳⚡", "🇮🇳🌟"],
      wicket: ["🇮🇳🔥", "🇮🇳💙", "🇮🇳✨"],
      neutral: ["🔹", "📛", "⚡", "🎯", "💠"],
    };
  }

  if (t.includes("pakistan") || o.includes("pakistan")) {
    return {
      hit: ["⚡", "📛", "💠"],
      wicket: ["⚡", "📛", "🎯"],
      neutral: ["⚡", "📛", "🔹"],
    };
  }

  return {
    hit: ["⚡", "📛", "💥", "🎯"],
    wicket: ["⚡", "📛", "🎯"],
    neutral: ["🔹", "⚡", "📛"],
  };
}

const HEADERS = [
  "🚨 {MATCH} Updates 🚨",
  "🔥 {MATCH} Action 🔥",
  "📢 {MATCH} Moment 📢",
];

const EVENT_HEADERS = {
  SIX: [
    "💥 BIG HIT ALERT!",
    "🔥 That's massive!",
    "⚡ Launches it!",
    "💣 Out of the park!",
    "🚀 What a strike!",
  ],

  FOUR: [
    "🔹 Crunched to the boundary!",
    "⚡ Finds the gap!",
    "🎯 Precision timing!",
    "💥 Races away!",
    "🔥 Beautiful shot!",
  ],

  WICKET: [
    "📛 BOWLED HIM!",
    "🎯 GOT THE BREAKTHROUGH!",
    "🔥 Edge & taken!",
    "⚡ That’s a huge wicket!",
    "💥 Clean dismissal!",
  ],

  BATSMAN_MILESTONE: [
    "🌟 Milestone Achieved!",
    "🔥 Brilliant knock!",
    "💯 What a performance!",
    "⚡ Class batting!",
    "👏 Standing ovation!",
  ],

  PARTNERSHIP_MILESTONE: [
    "🤝 Stand building strong!",
    "🔥 Partnership milestone!",
    "⚡ Batting in sync!",
    "🎯 Smart cricket!",
    "💥 Great understanding!",
  ],

  TEAM_MILESTONE: [
    "💯 Team milestone!",
    "⚡ Good momentum!",
    "🔥 Runs flowing!",
    "📛 Strong platform!",
    "🎯 Solid progress!",
  ],
};

// -----------------------------------------------
// BODY TEMPLATES (5 per event)
// -----------------------------------------------
const BODIES = {
  SIX: [
    "{BATTER} smashes a SIX {EMOJI} ",
    "{BATTER} sends it soaring for SIX! {EMOJI}",
    "Massive SIX by {BATTER}! {EMOJI}",
    "What a hit! {BATTER} goes downtown! {EMOJI}",
    "Clean strike — SIX by {BATTER}! {EMOJI}",
  ],

  FOUR: [
    "{BATTER} finds the boundary — FOUR! {EMOJI}",
    "Sweet timing! FOUR by {BATTER} {EMOJI}",
    "Classy shot — FOUR! {EMOJI}",
    "Lovely placement from {BATTER} — FOUR! {EMOJI}",
    "FOUR! {BATTER} keeps the scoreboard ticking {EMOJI}",
  ],

  WICKET: [
    "WICKET! {BATTER} is gone! {EMOJI}",
    "{BOWLER} strikes — {BATTER} departs! {EMOJI}",
    "{BATTER} dismissed! Big moment! {EMOJI}",
    "Breakthrough! {BATTER} is out! {EMOJI}",
    "{BOWLER} removes {BATTER}! {EMOJI}",
  ],

  BATSMAN_MILESTONE: [
    "{BATTER} reaches {RUNS}* ({BALLS} balls) {EMOJI}",
    "Milestone! {BATTER} gets to {RUNS}* {EMOJI}",
    "{RUNS}* for {BATTER}! Steady batting {EMOJI}",
    "{BATTER} brings up {RUNS}* — top knock {EMOJI}",
    "{BATTER} crosses {RUNS}* ({BALLS}) {EMOJI}",
  ],

  PARTNERSHIP_MILESTONE: [
    "{RUNS}-run partnership! {BAT1} & {BAT2} steady the innings {EMOJI}",
    "Partnership reaches {RUNS}! Excellent running {EMOJI}",
    "{BAT1} & {BAT2} add {RUNS} together! {EMOJI}",
    "{RUNS}-run stand! Momentum building {EMOJI}",
    "Solid partnership of {RUNS}! {EMOJI}",
  ],

  TEAM_MILESTONE: [
    "Team reaches {RUNS} {EMOJI}",
    "{RUNS} up on the board! Good intent {EMOJI}",
    "Milestone reached — {RUNS}! {EMOJI}",
    "Team moves to {RUNS}! Positive batting {EMOJI}",
    "{RUNS} comes up! Momentum on {EMOJI}",
  ],
  BOWLER_MILESTONE: [
    `{BOWLER} finishes with {WICKETS}/{RUNS} in {OVERS} overs {EMOJI}`,
    `What a spell! {BOWLER} grabs {WICKETS}-for {RUNS} in {OVERS} overs {EMOJI}`,
  ],
};

// -----------------------------------------------
// EXPORT FINAL TEMPLATE ENGINE
// -----------------------------------------------
export const TEMPLATES = {
  HEADERS,
  EVENT_HEADERS,
  BODIES,
};

export function buildMatchResultTemplate(match, resultText) {
  const { team1Short, team2Short, format } = match;

  // random headline styles
  const headlines = [
    "🏆 Match Result",
    "🏁 Full Time",
    "🎉 Final Result",
    "📢 Match Over",
    "✨ Full-Time Update",
    "🔔 Final Whistle",
  ];

  const headline = headlines[Math.floor(Math.random() * headlines.length)];

  // random emojis
  const emojis = ["🔥", "⭐", "💥", "👏", "🏏"];
  const symbol = emojis[Math.floor(Math.random() * emojis.length)];

  return `
  ${headline} ${symbol}
  
  ${resultText}
  
  #${match.team1Short} #${match.team2Short} #${match.format}
  `.trim();
}
