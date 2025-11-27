//commentaryEngine.js
export const simpleChaseTemplates = [
  "{TEAM} need {RUNS} runs in {BALLS} balls.",
  "{TEAM} require {RUNS} from {BALLS} balls.",
  "{TEAM} need {RUNS} off {BALLS}.",
  "{TEAM} need {RUNS} runs with {BALLS} balls left.",
  "{TEAM} must score {RUNS} in {BALLS} balls.",
  "{TEAM} have {BALLS} balls to get {RUNS} runs.",
  "{TEAM} chase {RUNS} with {BALLS} balls remaining.",
  "{RUNS} needed from {BALLS} balls for {TEAM}.",
  "{RUNS} off {BALLS} required by {TEAM}.",
  "{TEAM} need {RUNS} in {BALLS}.",
];

export function buildSimpleChaseText(team, runs, balls) {
  const t =
    simpleChaseTemplates[
      Math.floor(Math.random() * simpleChaseTemplates.length)
    ];

  return t
    .replace("{TEAM}", team)
    .replace("{RUNS}", runs)
    .replace("{BALLS}", balls);
}
