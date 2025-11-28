// template.js

export function getEmojiPack(team, opponent) {
  const t = team?.toLowerCase() || "";
  const o = opponent?.toLowerCase() || "";

  const isIndiaBatting = t.includes("india");
  const isIndiaBowling = o.includes("india");

  if (isIndiaBatting) {
    return {
      hit: ["🔥", "💥"],
      wicket: ["🔴", "📛", "❌"],
    };
  }

  if (isIndiaBowling) {
    return {
      hit: ["📛", "🔴"],
      wicket: ["🟩", "✅"],
    };
  }

  return {
    hit: ["🔥", "💥"],
    wicket: ["🔴", "📛"],
  };
}

const HEADERS = ["🚨 MATCH UPDATES 🚨", "🟢 LIVE MATCH UPDATES 🟢"];

const EVENT_HEADERS = {
  SIX: [
    "💥 BIG HIT ALERT!",
    "🔥 That's massive!",
    "💥 Launches it!",
    "💥 Out of the park!",
    "🔥 What a strike!",
  ],

  FOUR: [
    "🔥 Crunched to the boundary!",
    "💥 Finds the gap!",
    "🔥 Precision timing!",
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
    "{BATTER} smashes a SIX! 6️⃣ {EMOJI}",
    "{BATTER} sends it soaring for SIX! 6️⃣ {EMOJI}",
    "Massive hit! {BATTER} goes all the way for SIX! 6️⃣ {EMOJI}",
    "What a strike! {BATTER} sends it downtown — SIX! 6️⃣ {EMOJI}",
    "Clean connection from {BATTER} — SIX! 6️⃣ {EMOJI}",
  ],

  FOUR: [
    "{BATTER} finds the gap — FOUR! 4️⃣ {EMOJI}",
    "Sweet timing from {BATTER} — FOUR! 4️⃣ {EMOJI}",
    "Classy shot by {BATTER} — FOUR! 4️⃣ {EMOJI}",
    "{BATTER} places it beautifully — FOUR! 4️⃣ {EMOJI}",
    "FOUR! {BATTER} keeps the scoreboard moving 4️⃣ {EMOJI}",
  ],
  WICKET: [
    "WICKET! {BOWLER} gets {BATTER} {EMOJI}",
    "{BOWLER} gets the wicket — {BATTER} departs {EMOJI}",
    "{BATTER} is dismissed — courtesy of {BOWLER} {EMOJI}",
    "Break in play — {BOWLER} sends back {BATTER} {EMOJI}",
    "{BOWLER} removes {BATTER} {EMOJI}",
  ],

  BATSMAN_MILESTONE: [
    "{BATTER} reaches {RUNS}({BALLS} balls) {EMOJI}",
    "Milestone! {BATTER} gets to {RUNS} {EMOJI}",
    "{RUNS} for {BATTER}! Steady batting {EMOJI}",
    "{BATTER} brings up {RUNS} — top knock {EMOJI}",
    "{BATTER} crosses {RUNS}({BALLS}) {EMOJI}",
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
};
const BODIES_OPPONENT = {
  SIX: [
    "{BATTER} hits a SIX 6️⃣",
    "SIX for {BATTER} 6️⃣",
    "{BATTER} sends it over for SIX 6️⃣",
    "SIX from {BATTER} 6️⃣",
    "{BATTER} goes for a clean SIX 6️⃣",
  ],

  FOUR: [
    "{BATTER} finds the boundary — FOUR! 4️⃣",
    "FOUR for {BATTER} 4️⃣",
    "{BATTER} sends it for FOUR 4️⃣",
    "{BATTER} guides it away — FOUR 4️⃣",
    "FOUR! {BATTER} keeps the scoreboard moving 4️⃣",
  ],
  WICKET: [
    "WICKET! {BOWLER} gets {BATTER} {EMOJI}",
    "{BOWLER} dismisses {BATTER} {EMOJI}",
    "{BATTER} is out — {BOWLER} with the wicket {EMOJI}",
    "{BOWLER} sends back {BATTER} {EMOJI}",
    "Break in play — {BOWLER} removes {BATTER} {EMOJI}",
  ],

  BATSMAN_MILESTONE: [
    "{BATTER} reaches {RUNS}({BALLS} balls)",
    "Milestone! {BATTER} gets to {RUNS}",
    "{RUNS} for {BATTER}! Steady batting",
    "{BATTER} brings up {RUNS} — top knock",
    "{BATTER} crosses {RUNS}({BALLS})",
  ],

  PARTNERSHIP_MILESTONE: [
    "{RUNS}-run partnership! {BAT1} & {BAT2} steady the innings",
    "Partnership reaches {RUNS}! Excellent running",
    "{BAT1} & {BAT2} add {RUNS} together!",
    "{RUNS}-run stand! Momentum building",
    "Solid partnership of {RUNS}!",
  ],

  TEAM_MILESTONE: [
    "Team reaches {RUNS}",
    "{RUNS} up on the board! Good intent",
    "Milestone reached — {RUNS}!",
    "Team moves to {RUNS}! Positive batting",
    "{RUNS} comes up! Momentum on",
  ],
  BOWLER_MILESTONE: [
    `{BOWLER} finishes with {WICKETS}/{RUNS} in {OVERS} overs`,
    `What a spell! {BOWLER} grabs {WICKETS}-for {RUNS} in {OVERS} overs`,
  ],
};

// -----------------------------------------------
// EXPORT FINAL TEMPLATE ENGINE
// -----------------------------------------------
export const TEMPLATES = {
  HEADERS,
  EVENT_HEADERS,
  BODIES,
  BODIES_OPPONENT,
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
