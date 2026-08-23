import fetch from "node-fetch";

const BASE_URL = "https://www.cricbuzz.com/api/cricket-stats/stats-table";

const FORMAT_IDS = {
  test: "1",
  odi: "2",
  t20: "3",
};

const TEAM_IDS = {
  ALL: "all",

  IND: "2",
  INDIA: "2",

  IRE: "27",
  IRELAND: "27",

  PAK: "3",
  PAKISTAN: "3",

  AUS: "4",
  AUSTRALIA: "4",

  SL: "5",
  SRILANKA: "5",

  BAN: "6",
  BANGLADESH: "6",

  ENG: "9",
  ENGLAND: "9",

  WI: "10",
  WESTINDIES: "10",

  RSA: "11",
  SA: "11",
  SOUTHAFRICA: "11",

  ZIM: "12",
  ZIMBABWE: "12",

  NZ: "13",
  NEWZEALAND: "13",

  AFG: "96",
  AFGHANISTAN: "96",
};

const STAT_TYPES = {
  runs: "mostRuns",
  mostruns: "mostRuns",
  "most-runs": "mostRuns",

  sr: "highestSr",
  highestsr: "highestSr",
  "highest-sr": "highestSr",
  "strike-rate": "highestSr",
};

function getFormatId(format = "test") {
  const key = String(format).toLowerCase();

  if (!FORMAT_IDS[key]) {
    throw new Error(`Unsupported format "${format}". Use test, odi or t20.`);
  }

  return FORMAT_IDS[key];
}

function getTeamId(team = "all") {
  const normalized = String(team)
    .toUpperCase()
    .replace(/[\s_-]/g, "");

  if (TEAM_IDS[normalized]) {
    return TEAM_IDS[normalized];
  }

  // Allow direct Cricbuzz numeric IDs as well
  if (/^\d+$/.test(String(team))) {
    return String(team);
  }

  throw new Error(`Unknown team "${team}". Example: IND, AUS, ENG, RSA, NZ.`);
}

function getStatType(stat = "runs") {
  const key = String(stat).toLowerCase();

  if (!STAT_TYPES[key]) {
    throw new Error(`Unsupported stat "${stat}". Use runs or sr.`);
  }

  return STAT_TYPES[key];
}

function toNumber(value) {
  if (value === undefined || value === null || value === "") {
    return 0;
  }

  const number = Number(String(value).replace(/,/g, ""));

  return Number.isNaN(number) ? 0 : number;
}

/*
Cricbuzz webValues row:

[
  playerId,
  playerName,
  matches,
  innings,
  runs,
  avg,
  strikeRate,
  fours,
  sixes
]
*/

function mapPlayer(row) {
  return {
    id: row[0],
    name: row[1],
    matches: toNumber(row[2]),
    innings: toNumber(row[3]),
    runs: toNumber(row[4]),
    average: toNumber(row[5]),
    strikeRate: toNumber(row[6]),
    fours: toNumber(row[7]),
    sixes: toNumber(row[8]),
  };
}

export async function getBattingStats({
  stat = "runs",
  format = "test",
  year = "all",
  team = "all",
  opponent = "all",
} = {}) {
  const statType = getStatType(stat);
  const formatId = getFormatId(format);
  const teamId = getTeamId(team);
  const opponentId = getTeamId(opponent);

  const url =
    `${BASE_URL}/${statType}` +
    `/${formatId}` +
    `/${year}` +
    `/${teamId}` +
    `/${opponentId}`;

  const headers = {
    accept: "*/*",
    "content-type": "application/json",
    referer: "https://www.cricbuzz.com/cricket-stats",
    "user-agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
      "AppleWebKit/537.36 (KHTML, like Gecko) " +
      "Chrome/151.0.0.0 Safari/537.36",
  };

  /*
   * Usually try without cookies first.
   *
   * If Cricbuzz gives 403:
   *
   * export CRICBUZZ_COOKIE='your browser cookie'
   *
   * Then this automatically adds it.
   */
  if (process.env.CRICBUZZ_COOKIE) {
    headers.cookie = process.env.CRICBUZZ_COOKIE;
  }

  const response = await fetch(url, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const body = await response.text();

    throw new Error(
      `Cricbuzz stats API failed: ${response.status} ${response.statusText}\n${body}`,
    );
  }

  const data = await response.json();

  if (!Array.isArray(data?.webValues)) {
    throw new Error(
      `Unexpected Cricbuzz response.\n${JSON.stringify(data, null, 2)}`,
    );
  }

  return {
    url,
    headers: data.webHeaders || [],
    players: data.webValues.map(mapPlayer),
    raw: data,
  };
}
