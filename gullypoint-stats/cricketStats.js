import "dotenv/config";
import { getBattingStats } from "./cricbuzzStatsApi.js";

// import { getBattingStats } from "./cricbuzzStatsApi.js";

function printUsage() {
  console.log(`
Usage:

  node cricbuzz/testCricbuzzStats.js [options]

Options:

  --format test|odi|t20
  --team IND
  --opponent all
  --year all

  --stat runs|sr

  --min-matches 70
  --max-matches 100

  --min-avg 40
  --max-avg 50

  --min-runs 4000
  --max-runs 10000

  --min-sr 50
  --max-sr 80

  --sort average|matches|runs|sr
  --order asc|desc

Examples:

  node cricbuzz/testCricbuzzStats.js --format test --team IND --min-matches 70

  node cricbuzz/testCricbuzzStats.js --format test --team IND --min-matches 70 --max-avg 40

  node cricbuzz/testCricbuzzStats.js --format test --team IND --opponent AUS

  node cricbuzz/testCricbuzzStats.js --format odi --team IND --min-matches 100

  node cricbuzz/testCricbuzzStats.js --format test --team IND --stat sr --min-matches 50 --sort sr
`);
}

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

function numberOrNull(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const number = Number(value);

  if (Number.isNaN(number)) {
    return null;
  }

  return number;
}

function pad(value, width, align = "left") {
  const text = String(value);

  if (text.length >= width) {
    return text.slice(0, width);
  }

  return align === "right" ? text.padStart(width) : text.padEnd(width);
}

function formatRuns(value) {
  return Number(value).toLocaleString("en-IN");
}

function buildQueryDescription(filters) {
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

  if (filters.minRuns !== null) {
    conditions.push(`Runs >= ${filters.minRuns}`);
  }

  if (filters.maxRuns !== null) {
    conditions.push(`Runs <= ${filters.maxRuns}`);
  }

  if (filters.minSr !== null) {
    conditions.push(`SR >= ${filters.minSr}`);
  }

  if (filters.maxSr !== null) {
    conditions.push(`SR <= ${filters.maxSr}`);
  }

  return conditions.length ? conditions.join(" AND ") : "No additional filters";
}

function filterPlayers(players, filters) {
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

    if (filters.minRuns !== null && player.runs < filters.minRuns) {
      return false;
    }

    if (filters.maxRuns !== null && player.runs > filters.maxRuns) {
      return false;
    }

    if (filters.minSr !== null && player.strikeRate < filters.minSr) {
      return false;
    }

    if (filters.maxSr !== null && player.strikeRate > filters.maxSr) {
      return false;
    }

    return true;
  });
}

function sortPlayers(players, sort = "average", order = "desc") {
  const fieldMap = {
    average: "average",
    avg: "average",

    matches: "matches",
    match: "matches",

    runs: "runs",

    sr: "strikeRate",
    strikerate: "strikeRate",

    innings: "innings",
    fours: "fours",
    sixes: "sixes",
  };

  const field = fieldMap[String(sort).toLowerCase()] || "average";

  return [...players].sort((a, b) => {
    const difference = Number(a[field]) - Number(b[field]);

    return order === "asc" ? difference : -difference;
  });
}

function printTable(players, meta) {
  const WIDTH = 70;

  console.log("");
  console.log("=".repeat(WIDTH));

  console.log("GULLY POINT CRICKET STATS".padStart(47));

  console.log("=".repeat(WIDTH));

  console.log("");

  console.log(
    `${meta.team.toUpperCase()} | ${meta.format.toUpperCase()} | BATTING`,
  );

  if (meta.opponent && meta.opponent.toLowerCase() !== "all") {
    console.log(`Opponent: ${meta.opponent.toUpperCase()}`);
  }

  if (meta.year && String(meta.year).toLowerCase() !== "all") {
    console.log(`Year: ${meta.year}`);
  }

  console.log("");
  console.log(`Filter: ${meta.query}`);

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

  console.log(`Fetched: ${date} at ${time}`);

  console.log("");

  console.log("");

  console.log(
    pad("PLAYER", 25) +
      " " +
      pad("M", 6, "right") +
      " " +
      pad("RUNS", 10, "right") +
      " " +
      pad("AVG", 8, "right"),
  );

  console.log("-".repeat(WIDTH));

  for (const player of players) {
    console.log(
      pad(player.name, 25) +
        " " +
        pad(player.matches, 6, "right") +
        " " +
        pad(formatRuns(player.runs), 10, "right") +
        " " +
        pad(player.average.toFixed(2), 8, "right"),
    );
  }

  console.log("-".repeat(WIDTH));

  console.log("Analysis: Gully Point");
  console.log("");
}

async function main() {
  const args = parseArgs();

  if (args.help || args.h) {
    printUsage();
    return;
  }

  const format = args.format || "test";
  const team = args.team || "IND";
  const opponent = args.opponent || "all";
  const year = args.year || "all";
  const stat = args.stat || "runs";

  const filters = {
    minMatches: numberOrNull(args["min-matches"]),

    maxMatches: numberOrNull(args["max-matches"]),

    minAvg: numberOrNull(args["min-avg"]),

    maxAvg: numberOrNull(args["max-avg"]),

    minRuns: numberOrNull(args["min-runs"]),

    maxRuns: numberOrNull(args["max-runs"]),

    minSr: numberOrNull(args["min-sr"]),

    maxSr: numberOrNull(args["max-sr"]),
  };

  console.log("");
  //   console.log("Fetching Cricbuzz stats...");

  const result = await getBattingStats({
    stat,
    format,
    year,
    team,
    opponent,
  });

  let players = filterPlayers(result.players, filters);

  players = sortPlayers(
    players,
    args.sort || "average",
    String(args.order || "desc").toLowerCase(),
  );

  const query = buildQueryDescription(filters);

  printTable(players, {
    format,
    team,
    opponent,
    year,
    query,
  });
}

main().catch((error) => {
  console.error("");
  console.error("❌ ERROR");
  console.error(error.message);
  console.error("");

  process.exitCode = 1;
});
