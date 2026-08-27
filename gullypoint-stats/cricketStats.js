import "dotenv/config";

import { getBattingStats } from "./cricbuzzStatsApi.js";

/*
|--------------------------------------------------------------------------
| ARGUMENT PARSING
|--------------------------------------------------------------------------
*/

function parseArgs() {
  const input = process.argv.slice(2);
  const args = {};

  for (let i = 0; i < input.length; i++) {
    const current = input[i];

    if (!current.startsWith("--")) {
      continue;
    }

    const key = current.slice(2);
    const next = input[i + 1];

    if (next !== undefined && !next.startsWith("--")) {
      args[key] = next;
      i++;
    } else {
      args[key] = true;
    }
  }

  return args;
}

/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

function numberOrNull(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const number = Number(value);

  return Number.isNaN(number) ? null : number;
}

function pad(value, width, align = "left") {
  const text = String(value ?? "");

  if (text.length >= width) {
    return text.slice(0, width);
  }

  return align === "right" ? text.padStart(width) : text.padEnd(width);
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-IN");
}

/*
|--------------------------------------------------------------------------
| FILTER DESCRIPTION
|--------------------------------------------------------------------------
*/

function buildQueryDescription(filters, type) {
  const conditions = [];

  if (filters.minMatches !== null) {
    conditions.push(`Matches >= ${filters.minMatches}`);
  }

  if (filters.maxMatches !== null) {
    conditions.push(`Matches <= ${filters.maxMatches}`);
  }

  if (filters.minAvg !== null) {
    conditions.push(`Average >= ${filters.minAvg}`);
  }

  if (filters.maxAvg !== null) {
    conditions.push(`Average <= ${filters.maxAvg}`);
  }

  if (type === "batting") {
    if (filters.minRuns !== null) {
      conditions.push(`Runs >= ${filters.minRuns}`);
    }

    if (filters.maxRuns !== null) {
      conditions.push(`Runs <= ${filters.maxRuns}`);
    }
  }

  if (type === "bowling") {
    if (filters.minWickets !== null) {
      conditions.push(`Wickets >= ${filters.minWickets}`);
    }

    if (filters.maxWickets !== null) {
      conditions.push(`Wickets <= ${filters.maxWickets}`);
    }
  }

  return conditions.length ? conditions.join(" AND ") : "No additional filters";
}

/*
|--------------------------------------------------------------------------
| FILTER PLAYERS
|--------------------------------------------------------------------------
*/

function filterPlayers(players, filters, type) {
  return players.filter((player) => {
    if (filters.minMatches !== null && player.matches < filters.minMatches) {
      return false;
    }

    if (filters.maxMatches !== null && player.matches > filters.maxMatches) {
      return false;
    }

    if (filters.minAvg !== null && player.average < filters.minAvg) {
      return false;
    }

    if (filters.maxAvg !== null && player.average > filters.maxAvg) {
      return false;
    }

    if (type === "batting") {
      if (filters.minRuns !== null && player.runs < filters.minRuns) {
        return false;
      }

      if (filters.maxRuns !== null && player.runs > filters.maxRuns) {
        return false;
      }
    }

    if (type === "bowling") {
      if (filters.minWickets !== null && player.wickets < filters.minWickets) {
        return false;
      }

      if (filters.maxWickets !== null && player.wickets > filters.maxWickets) {
        return false;
      }
    }

    return true;
  });
}

/*
|--------------------------------------------------------------------------
| SORTING
|--------------------------------------------------------------------------
*/

function sortPlayers(players, sort, order, type) {
  // const battingFields = {
  //   average: "average",
  //   avg: "average",

  //   matches: "matches",
  //   match: "matches",
  //   m: "matches",

  //   runs: "runs",
  // };
  const battingFields = {
    average: "average",
    avg: "average",

    matches: "matches",
    match: "matches",
    m: "matches",

    runs: "runs",

    sr: "strikeRate",
    strikerate: "strikeRate",
    "strike-rate": "strikeRate",
  };

  const bowlingFields = {
    average: "average",
    avg: "average",

    matches: "matches",
    match: "matches",
    m: "matches",

    wickets: "wickets",
    wicket: "wickets",
    wkts: "wickets",
    w: "wickets",

    runs: "runs",

    balls: "balls",

    "4fers": "fourFers",
    fourfers: "fourFers",

    "5fers": "fiveFers",
    fivefers: "fiveFers",
  };

  const fieldMap = type === "bowling" ? bowlingFields : battingFields;

  const defaultField = type === "bowling" ? "wickets" : "average";

  const normalizedSort = String(sort || defaultField).toLowerCase();

  const field = fieldMap[normalizedSort] || defaultField;

  return [...players].sort((a, b) => {
    const aValue = Number(a[field]) || 0;
    const bValue = Number(b[field]) || 0;

    const difference = aValue - bValue;

    return order === "asc" ? difference : -difference;
  });
}

/*
|--------------------------------------------------------------------------
| TIMESTAMP
|--------------------------------------------------------------------------
*/

function getFetchedTimestamp() {
  const fetchedAt = new Date();

  const date = fetchedAt.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });

  const time = fetchedAt.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });

  return `${date} at ${time}`;
}

/*
|--------------------------------------------------------------------------
| PRINT TABLE
|--------------------------------------------------------------------------
*/

function printTable(players, meta) {
  const WIDTH = 76;

  console.log("");
  // console.log("=".repeat(WIDTH));

  // console.log("GULLY POINT CRICKET STATS".padStart(47));

  // console.log("=".repeat(WIDTH));
  console.log("");

  console.log(
    `${meta.team.toUpperCase()} | ${meta.format.toUpperCase()} | ${meta.type.toUpperCase()}`,
  );

  if (meta.opponent && String(meta.opponent).toLowerCase() !== "all") {
    console.log(`Opponent: ${meta.opponent.toUpperCase()}`);
  }

  if (meta.year && String(meta.year).toLowerCase() !== "all") {
    console.log(`Year: ${meta.year}`);
  }

  console.log("");

  console.log(`Filter: ${meta.query}`);

  console.log(`Fetched: ${getFetchedTimestamp()}`);

  console.log("");

  /*
  |--------------------------------------------------------------------------
  | BOWLING TABLE
  |--------------------------------------------------------------------------
  */

  if (meta.type === "bowling") {
    console.log(
      pad("# ", 3, "right") +
        " " +
        pad("PLAYER", 25) +
        " " +
        pad("M", 6, "right") +
        " " +
        pad("WKTS", 8, "right") +
        " " +
        pad("AVG", 8, "right") +
        " " +
        pad("5W", 6, "right"),
    );

    console.log("-".repeat(WIDTH));

    players.forEach((player, index) => {
      console.log(
        pad(index + 1 + ".", 3, "right") +
          " " +
          pad(player.name, 25) +
          " " +
          pad(player.matches, 6, "right") +
          " " +
          pad(player.wickets, 8, "right") +
          " " +
          pad(Number(player.average || 0).toFixed(2), 8, "right") +
          " " +
          pad(player.fiveFers ?? 0, 6, "right"),
      );
    });
  } else {
    /*
  |--------------------------------------------------------------------------
  | BATTING TABLE
  |--------------------------------------------------------------------------
  */
    console.log(
      pad("#", 3, "right") +
        " " +
        pad("PLAYER", 25) +
        " " +
        pad("M", 6, "right") +
        " " +
        pad("RUNS", 10, "right") +
        " " +
        pad("AVG", 8, "right"),
      " " + pad("SR", 8, "right"),
    );

    console.log("-".repeat(WIDTH));

    players.forEach((player, index) => {
      console.log(
        pad(index + 1, 3, "right") +
          " " +
          pad(player.name, 25) +
          " " +
          pad(player.matches, 6, "right") +
          " " +
          pad(formatNumber(player.runs), 10, "right") +
          " " +
          pad(Number(player.average || 0).toFixed(2), 8, "right") +
          " " +
          pad(Number(player.strikeRate || 0).toFixed(2), 8, "right"),
      );
    });
  }

  console.log("-".repeat(WIDTH));

  console.log("Analysis: Gully Point");
  console.log("");
}

/*
|--------------------------------------------------------------------------
| USAGE
|--------------------------------------------------------------------------
*/

function printUsage() {
  console.log(`
GULLY POINT CRICKET STATS

BATTING:

node gullypoint-stats/cricketStats.js \\
  --type batting \\
  --format test \\
  --team IND \\
  --min-matches 70 \\
  --sort avg \\
  --order desc


BOWLING:

node gullypoint-stats/cricketStats.js \\
  --type bowling \\
  --format test \\
  --team IND \\
  --sort wickets \\
  --order desc


OPTIONS:

--type batting|bowling

--format test|odi|t20

--team IND
--opponent AUS
--year 2026

--min-matches 20
--max-matches 100

--min-avg 20
--max-avg 40

BATTING:

--min-runs 1000
--max-runs 10000

BOWLING:

--min-wickets 50
--max-wickets 500

SORT:

Batting:
--sort avg
--sort runs
--sort matches

Bowling:
--sort wickets
--sort avg
--sort matches
--sort runs
--sort fivefers

ORDER:

--order asc
--order desc
`);
}

/*
|--------------------------------------------------------------------------
| MAIN
|--------------------------------------------------------------------------
*/

async function main() {
  const args = parseArgs();

  if (args.help || args.h) {
    printUsage();
    return;
  }

  /*
  |--------------------------------------------------------------------------
  | TYPE
  |--------------------------------------------------------------------------
  */

  const type = String(args.type || "batting").toLowerCase();

  if (type !== "batting" && type !== "bowling") {
    throw new Error(`Invalid type "${type}". Use batting or bowling.`);
  }

  /*
  |--------------------------------------------------------------------------
  | BASIC QUERY
  |--------------------------------------------------------------------------
  */

  const format = args.format || "test";

  const team = args.team || "IND";

  const opponent = args.opponent || "all";

  const year = args.year || "all";

  /*
  |--------------------------------------------------------------------------
  | CRICBUZZ STAT TABLE
  |--------------------------------------------------------------------------
  */

  const stat = args.stat || (type === "bowling" ? "wickets" : "runs");

  /*
  |--------------------------------------------------------------------------
  | FILTERS
  |--------------------------------------------------------------------------
  */

  const filters = {
    minMatches: numberOrNull(args["min-matches"]),

    maxMatches: numberOrNull(args["max-matches"]),

    minAvg: numberOrNull(args["min-avg"]),

    maxAvg: numberOrNull(args["max-avg"]),

    minRuns: numberOrNull(args["min-runs"]),

    maxRuns: numberOrNull(args["max-runs"]),

    minWickets: numberOrNull(args["min-wickets"]),

    maxWickets: numberOrNull(args["max-wickets"]),
  };

  /*
  |--------------------------------------------------------------------------
  | FETCH
  |--------------------------------------------------------------------------
  */

  const result = await getBattingStats({
    stat,
    format,
    year,
    team,
    opponent,
  });

  /*
  |--------------------------------------------------------------------------
  | FILTER
  |--------------------------------------------------------------------------
  */

  let players = filterPlayers(result.players, filters, type);
  const includedPlayers = args.include
    ? String(args.include)
        .split(",")
        .map((name) => name.trim().toLowerCase())
        .filter(Boolean)
    : [];

  const excludedPlayers = args.exclude
    ? String(args.exclude)
        .split(",")
        .map((name) => name.trim().toLowerCase())
        .filter(Boolean)
    : [];

  if (includedPlayers.length > 0) {
    players = players.filter((player) =>
      includedPlayers.includes(String(player.name).toLowerCase()),
    );
  }

  if (excludedPlayers.length > 0) {
    players = players.filter(
      (player) => !excludedPlayers.includes(String(player.name).toLowerCase()),
    );
  }

  // const excludedPlayers = args.exclude
  //   ? String(args.exclude)
  //       .split(",")
  //       .map((name) => name.trim().toLowerCase())
  //       .filter(Boolean)
  //   : [];

  // if (excludedPlayers.length > 0) {
  //   players = players.filter(
  //     (player) => !excludedPlayers.includes(String(player.name).toLowerCase()),
  //   );
  // }

  /*
  |--------------------------------------------------------------------------
  | SORT
  |--------------------------------------------------------------------------
  */

  const defaultSort = type === "bowling" ? "wickets" : "average";

  players = sortPlayers(
    players,
    args.sort || defaultSort,
    String(args.order || "desc").toLowerCase(),
    type,
  );

  /*
  |--------------------------------------------------------------------------
  | DISPLAY QUERY
  |--------------------------------------------------------------------------
  */

  const query = buildQueryDescription(filters, type);

  /*
  |--------------------------------------------------------------------------
  | OUTPUT
  |--------------------------------------------------------------------------
  */

  printTable(players, {
    type,
    format,
    team,
    opponent,
    year,
    query,
  });
}

/*
|--------------------------------------------------------------------------
| RUN
|--------------------------------------------------------------------------
*/

main().catch((error) => {
  console.error("");
  console.error("❌ ERROR");
  console.error(error.message);
  console.error("");

  process.exitCode = 1;
});
