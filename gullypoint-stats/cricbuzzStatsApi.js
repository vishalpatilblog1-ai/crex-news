import fetch from "node-fetch";

const BASE_URL = "https://www.cricbuzz.com/api/cricket-stats/stats-table";

/*
|--------------------------------------------------------------------------
| FORMAT IDS
|--------------------------------------------------------------------------
*/

const FORMAT_IDS = {
  test: "1",
  odi: "2",
  t20: "3",
};

/*
|--------------------------------------------------------------------------
| TEAM IDS
|--------------------------------------------------------------------------
*/

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

/*
|--------------------------------------------------------------------------
| STAT TYPES
|--------------------------------------------------------------------------
*/

const STAT_TYPES = {
  /*
  |--------------------------------------------------------------------------
  | BATTING
  |--------------------------------------------------------------------------
  */

  runs: "mostRuns",
  mostruns: "mostRuns",
  "most-runs": "mostRuns",

  sr: "highestSr",
  highestsr: "highestSr",
  "highest-sr": "highestSr",
  "strike-rate": "highestSr",

  /*
  |--------------------------------------------------------------------------
  | BOWLING
  |--------------------------------------------------------------------------
  */

  wickets: "mostWickets",
  wicket: "mostWickets",
  wkts: "mostWickets",
  w: "mostWickets",

  mostwickets: "mostWickets",
  "most-wickets": "mostWickets",
};

/*
|--------------------------------------------------------------------------
| FORMAT
|--------------------------------------------------------------------------
*/

function getFormatId(format = "test") {
  const normalized = String(format).toLowerCase().trim();

  if (FORMAT_IDS[normalized]) {
    return FORMAT_IDS[normalized];
  }

  /*
   * Allow direct numeric Cricbuzz format IDs
   */
  if (/^\d+$/.test(normalized)) {
    return normalized;
  }

  throw new Error(`Unsupported format "${format}". Use test, odi or t20.`);
}

/*
|--------------------------------------------------------------------------
| TEAM
|--------------------------------------------------------------------------
*/

function getTeamId(team = "all") {
  const normalized = String(team)
    .toUpperCase()
    .replace(/[\s_-]/g, "");

  if (TEAM_IDS[normalized]) {
    return TEAM_IDS[normalized];
  }

  /*
   * Allow direct Cricbuzz numeric team IDs
   */
  if (/^\d+$/.test(String(team))) {
    return String(team);
  }

  throw new Error(`Unknown team "${team}". Example: IND, AUS, ENG, RSA, NZ.`);
}

/*
|--------------------------------------------------------------------------
| STAT TYPE
|--------------------------------------------------------------------------
*/

function getStatType(stat = "runs") {
  const normalized = String(stat).toLowerCase().trim();

  if (STAT_TYPES[normalized]) {
    return STAT_TYPES[normalized];
  }

  throw new Error(`Unsupported stat "${stat}". Use runs, sr or wickets.`);
}

/*
|--------------------------------------------------------------------------
| NUMBER
|--------------------------------------------------------------------------
*/

function toNumber(value) {
  if (value === undefined || value === null || value === "") {
    return 0;
  }

  const number = Number(String(value).replace(/,/g, ""));

  return Number.isNaN(number) ? 0 : number;
}

/*
|--------------------------------------------------------------------------
| BATTING MAPPER
|--------------------------------------------------------------------------
|
| Cricbuzz batting webValues:
|
| [
|   playerId,
|   playerName,
|   matches,
|   innings,
|   runs,
|   average,
|   strikeRate,
|   fours,
|   sixes
| ]
|
|--------------------------------------------------------------------------
*/

function mapBatter(row) {
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

    type: "batting",
  };
}

/*
|--------------------------------------------------------------------------
| BOWLING MAPPER
|--------------------------------------------------------------------------
|
| Cricbuzz bowling webValues:
|
| [
|   playerId,
|   playerName,
|   matches,
|   overs,
|   balls,
|   wickets,
|   average,
|   runs,
|   fourFers,
|   fiveFers
| ]
|
|--------------------------------------------------------------------------
*/

function mapBowler(row) {
  return {
    id: row[0],
    name: row[1],

    matches: toNumber(row[2]),

    /*
     * Overs should stay as a string because values like
     * 6808.2 mean 6808 overs + 2 balls, not decimal overs.
     */
    overs: row[3],

    balls: toNumber(row[4]),
    wickets: toNumber(row[5]),

    average: toNumber(row[6]),
    runs: toNumber(row[7]),

    fourFers: toNumber(row[8]),
    fiveFers: toNumber(row[9]),

    type: "bowling",
  };
}

/*
|--------------------------------------------------------------------------
| IDENTIFY TABLE TYPE
|--------------------------------------------------------------------------
*/

function getTableType(statType) {
  if (statType === "mostWickets") {
    return "bowling";
  }

  return "batting";
}

/*
|--------------------------------------------------------------------------
| FETCH CRICBUZZ STATS
|--------------------------------------------------------------------------
*/

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

  const tableType = getTableType(statType);

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
      "Mozilla/5.0 " +
      "(Macintosh; Intel Mac OS X 10_15_7) " +
      "AppleWebKit/537.36 " +
      "(KHTML, like Gecko) " +
      "Chrome/151.0.0.0 " +
      "Safari/537.36",
  };

  /*
  |--------------------------------------------------------------------------
  | OPTIONAL COOKIE
  |--------------------------------------------------------------------------
  |
  | Normally try without cookies.
  |
  | If Cricbuzz returns 403:
  |
  | export CRICBUZZ_COOKIE='your cookie'
  |
  |--------------------------------------------------------------------------
  */

  if (process.env.CRICBUZZ_COOKIE) {
    headers.cookie = process.env.CRICBUZZ_COOKIE;
  }

  /*
  |--------------------------------------------------------------------------
  | REQUEST
  |--------------------------------------------------------------------------
  */

  const response = await fetch(url, {
    method: "GET",
    headers,
  });

  /*
  |--------------------------------------------------------------------------
  | HTTP ERROR
  |--------------------------------------------------------------------------
  */

  if (!response.ok) {
    const body = await response.text();

    throw new Error(
      `Cricbuzz stats API failed: ` +
        `${response.status} ` +
        `${response.statusText}\n\n` +
        `${body}`,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | JSON
  |--------------------------------------------------------------------------
  */

  const data = await response.json();

  /*
  |--------------------------------------------------------------------------
  | VALIDATE RESPONSE
  |--------------------------------------------------------------------------
  */

  if (!Array.isArray(data?.webValues)) {
    throw new Error(
      `Unexpected Cricbuzz response.\n\n` + JSON.stringify(data, null, 2),
    );
  }

  /*
  |--------------------------------------------------------------------------
  | MAP RESPONSE
  |--------------------------------------------------------------------------
  */

  const mapper = tableType === "bowling" ? mapBowler : mapBatter;

  const players = data.webValues.map(mapper);

  /*
  |--------------------------------------------------------------------------
  | RETURN
  |--------------------------------------------------------------------------
  */

  return {
    url,

    statType,
    tableType,

    format,
    formatId,

    year,

    team,
    teamId,

    opponent,
    opponentId,

    headers: data.webHeaders || [],

    players,

    raw: data,
  };
}

/*
|--------------------------------------------------------------------------
| OPTIONAL BETTER-NAMED EXPORT
|--------------------------------------------------------------------------
|
| cricketStats.js can continue using getBattingStats().
|
| But technically it now fetches both batting and bowling,
| so this alias is provided for future cleanup.
|
|--------------------------------------------------------------------------
*/

export const getCricketStats = getBattingStats;
