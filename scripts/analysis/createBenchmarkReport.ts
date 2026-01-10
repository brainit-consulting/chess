import fs from "fs";
import path from "path";
import { execSync } from "child_process";

type WdlSummary = {
  wins: number;
  draws: number;
  losses: number;
  total: number;
  skipped: number;
};

function getGitValue(command: string, fallback: string) {
  try {
    return execSync(command, { encoding: "utf8" }).trim();
  } catch {
    return fallback;
  }
}

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const eqIndex = arg.indexOf("=");
    if (eqIndex > -1) {
      const key = arg.slice(2, eqIndex);
      const value = arg.slice(eqIndex + 1);
      args[key] = value;
      continue;
    }
    const key = arg.slice(2);
    const value = argv[i + 1];
    if (value && !value.startsWith("--")) {
      args[key] = value;
      i += 1;
    } else {
      args[key] = "true";
    }
  }
  return args;
}

function readPgnHeaders(filePath: string) {
  const content = fs.readFileSync(filePath, "utf8");
  const headers: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\[(\w+) "(.*)"\]$/);
    if (!match) continue;
    headers[match[1]] = match[2];
  }
  return headers;
}

function summarizeWdlFromPgnDir(pgnDir: string, engineName: string): WdlSummary | null {
  if (!fs.existsSync(pgnDir)) return null;
  const entries = fs.readdirSync(pgnDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".pgn"))
    .map((entry) => path.join(pgnDir, entry.name));

  if (files.length === 0) return null;

  let wins = 0;
  let draws = 0;
  let losses = 0;
  let skipped = 0;

  for (const filePath of files) {
    const headers = readPgnHeaders(filePath);
    const result = (headers.Result || "").trim();
    const white = (headers.White || "").toLowerCase();
    const black = (headers.Black || "").toLowerCase();

    const engineIsWhite = white.includes(engineName);
    const engineIsBlack = black.includes(engineName);

    if (!engineIsWhite && !engineIsBlack) {
      skipped += 1;
      continue;
    }

    if (result === "1/2-1/2") {
      draws += 1;
      continue;
    }

    if (engineIsWhite) {
      if (result === "1-0") wins += 1;
      else if (result === "0-1") losses += 1;
      else skipped += 1;
      continue;
    }

    if (engineIsBlack) {
      if (result === "0-1") wins += 1;
      else if (result === "1-0") losses += 1;
      else skipped += 1;
    }
  }

  const total = wins + draws + losses;
  return { wins, draws, losses, total, skipped };
}

const args = parseArgs(process.argv.slice(2));
const runName = args.run || args.name;
if (!runName) {
  console.error("Usage: npx tsx scripts/analysis/createBenchmarkReport.ts --run <run_name> [--baseline <hash>] [--variant <hash>] [--command <cmd>] [--time-control <tc>] [--opponent <opp>] [--games <n>] [--hypothesis <text>] [--change <text>] [--notes <text>] [--pgn-dir <dir>] [--engine <name>] [--wdl <w-d-l>] [--score <pct>]");
  process.exit(1);
}

const baselineHash = args.baseline || "<baseline git hash>";
const variantHash = args.variant || getGitValue("git rev-parse HEAD", "<variant git hash>");
const branch = getGitValue("git rev-parse --abbrev-ref HEAD", "<branch>");
const now = new Date().toISOString();

const engineLabel = args.engine || "Scorpion";
const pgnDir = args["pgn-dir"] || args.pgnDir;
const derived = pgnDir ? summarizeWdlFromPgnDir(pgnDir, engineLabel.toLowerCase()) : null;

const wdl = args.wdl || (derived ? `${derived.wins}-${derived.draws}-${derived.losses}` : "");
const games = args.games || (derived ? String(derived.total) : "");
const score = args.score || (derived && derived.total > 0
  ? ((derived.wins + derived.draws * 0.5) / derived.total).toFixed(3)
  : "");

let notes = args.notes || "";
if (derived && derived.skipped > 0) {
  const skippedNote = `Skipped ${derived.skipped} PGN(s) without engine \"${engineLabel}\"`;
  notes = notes ? `${notes}; ${skippedNote}` : skippedNote;
}

const report = `# Benchmark Report - ${runName}

## 1) Purpose
- Hypothesis: ${args.hypothesis || ""}
- Change summary: ${args.change || ""}

## 2) Settings
- Baseline git hash: ${baselineHash}
- Variant git hash: ${variantHash}
- Branch: ${branch}
- Script/command: ${args.command || ""}
- Time control: ${args["time-control"] || ""}
- Opponent settings: ${args.opponent || ""}
- Games: ${games}
- Run date: ${now}

## 3) Results
- W/D/L: ${wdl}
- Score %: ${score}
- Elo estimate: ${args.elo || ""}
- Confidence notes: ${notes}

## 4) Decision
- Accepted / Inconclusive / Regression
- Rationale:
`;

const outputDir = path.join("analysis");
fs.mkdirSync(outputDir, { recursive: true });
const outputPath = path.join(outputDir, `${runName}_summary.md`);
fs.writeFileSync(outputPath, report, "utf8");
console.log(`Wrote ${outputPath}`);
