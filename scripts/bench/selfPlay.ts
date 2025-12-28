import { promises as fs } from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { Worker } from 'node:worker_threads';
import {
  Color,
  GameState,
  Move,
  PieceType,
  applyMove,
  createInitialState,
  getAllLegalMoves,
  getGameStatus
} from '../../src/rules';
import { buildSan, buildSanLine, PgnMove } from '../../src/pgn/pgn';
import { MAX_THINKING_DEPTH_CAP } from '../../src/ai/ai';

type EngineSide = 'hard' | 'max';

type RunConfig = {
  batchSize: number;
  hardMs: number;
  maxMs: number;
  maxPlies: number;
  swap: boolean;
  outDir?: string;
  baseSeed: number;
};

type SideTimings = {
  avgMs: number;
  maxMs: number;
  timeouts: number;
  moveCount: number;
};

type GameLog = {
  gameId: number;
  round: number;
  startedAt: string;
  finishedAt: string;
  hardMs: number;
  maxMs: number;
  whiteLabel: string;
  blackLabel: string;
  seed: number;
  plies: number;
  finalFen: string;
  lastMoveUci: string | null;
  lastMoveSan: string | null;
  termination: {
    status: string;
    reason?: string;
    trigger: string;
    message?: string;
  };
  result: string;
  outcome: 'win' | 'loss' | 'draw';
  endReason: string;
  timings: {
    hard: SideTimings;
    max: SideTimings;
  };
};

type MoveTiming = {
  ply: number;
  color: Color;
  side: EngineSide;
  ms: number;
  timedOut: boolean;
};

type RunSummary = {
  runId: string;
  startedAt: string;
  finishedAt: string;
  commitSha: string;
  config: {
    batchSize: number;
    hardMs: number;
    maxMs: number;
    maxPlies: number;
    swap: boolean;
    baseSeed: number;
    outDir: string;
  };
  totals: {
    games: number;
    wins: number;
    draws: number;
    losses: number;
    avgPlies: number;
    endReasons: Record<string, number>;
  };
  splits: {
    hardAsWhite: { wins: number; draws: number; losses: number };
    hardAsBlack: { wins: number; draws: number; losses: number };
  };
  timing: {
    hard: SideTimings;
    max: SideTimings;
  };
};

const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_HARD_MS = 800;
const DEFAULT_MAX_MS = 10000;
const DEFAULT_MAX_PLIES = 200;
const DEFAULT_BASE_SEED = 1000;
const ENGINE_TIMEOUT_GRACE_MS = 80;
const MIN_PLIES_FOR_DRAW = 2;

const REPORT_PATH = path.resolve('benchmarks/selfplay/SelfPlayReport.md');
const ROOT_OUTPUT_DIR = path.resolve('benchmarks/selfplay');

const OPENINGS: string[][] = [
  ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6'],
  ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'g8f6'],
  ['c2c4', 'e7e5', 'b1c3', 'g8f6', 'g2g3', 'd7d5'],
  ['g1f3', 'd7d5', 'g2g3', 'g8f6', 'f1g2', 'e7e6'],
  ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4'],
  ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'b1c3', 'd7d5'],
  ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'b1c3', 'f8b4'],
  ['e2e4', 'c7c6', 'd2d4', 'd7d5', 'b1c3', 'd5e4'],
  ['c2c4', 'e7e6', 'b1c3', 'd7d5', 'd2d4', 'g8f6'],
  ['e2e4', 'd7d6', 'd2d4', 'g8f6', 'b1c3', 'g7g6']
];

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const PROMO_MAP: Record<string, PieceType> = {
  q: 'queen',
  r: 'rook',
  b: 'bishop',
  n: 'knight'
};

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const runId = args.runId ?? formatRunId(new Date());
  const outDir =
    args.outDir ??
    path.join(ROOT_OUTPUT_DIR, `run-${runId}`);

  const config: RunConfig = {
    batchSize: args.batchSize ?? DEFAULT_BATCH_SIZE,
    hardMs: args.hardMs ?? DEFAULT_HARD_MS,
    maxMs: args.maxMs ?? DEFAULT_MAX_MS,
    maxPlies: args.maxPlies ?? DEFAULT_MAX_PLIES,
    swap: args.swap ?? false,
    outDir,
    baseSeed: args.baseSeed ?? DEFAULT_BASE_SEED
  };

  await fs.mkdir(outDir, { recursive: true });
  await fs.mkdir(ROOT_OUTPUT_DIR, { recursive: true });

  const runStart = new Date().toISOString();
  const allGameLogs: GameLog[] = [];
  const endReasons: Record<string, number> = {
    mate: 0,
    stalemate: 0,
    repetition: 0,
    fiftyMove: 0,
    other: 0
  };
  let totalPlies = 0;
  let wins = 0;
  let draws = 0;
  let losses = 0;
  const splits = {
    hardAsWhite: { wins: 0, draws: 0, losses: 0 },
    hardAsBlack: { wins: 0, draws: 0, losses: 0 }
  };
  const timingTotals = {
    hard: { totalMs: 0, maxMs: 0, timeouts: 0, moveCount: 0 },
    max: { totalMs: 0, maxMs: 0, timeouts: 0, moveCount: 0 }
  };

  const rounds = buildRounds(config.batchSize, config.swap);
  for (let index = 0; index < rounds.length; index += 1) {
    const round = rounds[index];
    const gameId = index + 1;
    const opening = OPENINGS[index % OPENINGS.length];
    const seed = config.baseSeed + index;

    const result = await runSingleGame({
      gameId,
      round: round.round,
      opening,
      white: round.white,
      hardMs: config.hardMs,
      maxMs: config.maxMs,
      maxPlies: config.maxPlies,
      seed
    });

    allGameLogs.push(result.log);
    totalPlies += result.plies;
    endReasons[result.endReason] = (endReasons[result.endReason] ?? 0) + 1;
    if (result.outcome === 'win') {
      wins += 1;
      if (round.white === 'hard') {
        splits.hardAsWhite.wins += 1;
      } else {
        splits.hardAsBlack.wins += 1;
      }
    } else if (result.outcome === 'loss') {
      losses += 1;
      if (round.white === 'hard') {
        splits.hardAsWhite.losses += 1;
      } else {
        splits.hardAsBlack.losses += 1;
      }
    } else {
      draws += 1;
      if (round.white === 'hard') {
        splits.hardAsWhite.draws += 1;
      } else {
        splits.hardAsBlack.draws += 1;
      }
    }

    for (const side of ['hard', 'max'] as const) {
      timingTotals[side].totalMs += result.timings[side].avgMs * result.timings[side].moveCount;
      timingTotals[side].maxMs = Math.max(timingTotals[side].maxMs, result.timings[side].maxMs);
      timingTotals[side].timeouts += result.timings[side].timeouts;
      timingTotals[side].moveCount += result.timings[side].moveCount;
    }

    const gameSlug = gameId.toString().padStart(4, '0');
    await fs.writeFile(
      path.join(outDir, `game-${gameSlug}.pgn`),
      result.pgn,
      'utf8'
    );
    await fs.writeFile(
      path.join(outDir, `game-${gameSlug}-meta.json`),
      JSON.stringify(result.log, null, 2),
      'utf8'
    );
    console.log(`Game ${gameSlug}: ${result.result} (${result.outcome})`);
  }

  const runFinished = new Date().toISOString();
  const summary = buildSummary({
    runId,
    startedAt: runStart,
    finishedAt: runFinished,
    config,
    wins,
    draws,
    losses,
    totalPlies,
    endReasons,
    splits,
    timingTotals
  });

  await fs.writeFile(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');
  await fs.writeFile(
    path.join(outDir, 'README.md'),
    buildRunReadme(),
    'utf8'
  );

  await fs.writeFile(
    path.join(ROOT_OUTPUT_DIR, 'summary.json'),
    JSON.stringify(summary, null, 2),
    'utf8'
  );
  await updateReport(summary);

  console.log(`Run complete. Summary saved to ${path.join(outDir, 'summary.json')}`);
}

async function runSingleGame(options: {
  gameId: number;
  round: number;
  opening: string[];
  white: EngineSide;
  hardMs: number;
  maxMs: number;
  maxPlies: number;
  seed: number;
}): Promise<{
  result: string;
  outcome: 'win' | 'loss' | 'draw';
  pgn: string;
  plies: number;
  endReason: string;
  log: GameLog;
  timings: { hard: SideTimings; max: SideTimings };
}> {
  const state = createInitialState();
  const pgnMoves: PgnMove[] = [];
  const moveTimings: MoveTiming[] = [];
  let lastMoveUci: string | null = null;
  let lastMoveSan: string | null = null;
  const openingResult = applyOpening(state, options.opening, pgnMoves);
  let plies = openingResult.plies;
  lastMoveUci = openingResult.lastMoveUci;
  lastMoveSan = openingResult.lastMoveSan;
  const rng = createSeededRng(options.seed);
  let engineWorker = createEngineWorker();
  const startedAt = new Date().toISOString();

  try {
    while (plies < options.maxPlies) {
      const status = getGameStatus(state);
      if (status.status === 'checkmate' || status.status === 'stalemate' || status.status === 'draw') {
        if (plies < MIN_PLIES_FOR_DRAW && status.status !== 'checkmate') {
          throw new Error('Game ended before minimum plies.');
        }
        const endReason = categorizeEndReason(status.status, status.reason);
        const final = finalizeGame(
          state,
          status.status,
          status.winner,
          pgnMoves,
          options.white,
          options.round,
          options.hardMs,
          options.maxMs
        );
        const timings = summarizeTimings(moveTimings);
        return {
          ...final,
          plies,
          endReason,
          timings,
          log: {
            gameId: options.gameId,
            round: options.round,
            startedAt,
            finishedAt: new Date().toISOString(),
            hardMs: options.hardMs,
            maxMs: options.maxMs,
            whiteLabel: labelForSide(options.white),
            blackLabel: labelForSide(options.white === 'hard' ? 'max' : 'hard'),
            seed: options.seed,
            plies,
            finalFen: stateToFen(state),
            lastMoveUci,
            lastMoveSan,
            termination: {
              status: status.status,
              reason: status.reason,
              trigger: 'engine_status'
            },
            result: final.result,
            outcome: final.outcome,
            endReason,
            timings
          }
        };
      }

      const side = state.activeColor === 'w' ? options.white : options.white === 'hard' ? 'max' : 'hard';
      const targetMs = side === 'hard' ? options.hardMs : options.maxMs;
      const moveResult = await pickEngineMove(
        state,
        {
          side,
          targetMs
        },
        rng,
        engineWorker
      );

      if (moveResult.worker) {
        engineWorker = moveResult.worker;
      }
      if (!moveResult.move) {
        throw new Error(moveResult.message ?? 'Engine returned no move.');
      }

      moveTimings.push({
        ply: plies + 1,
        color: state.activeColor,
        side,
        ms: moveResult.elapsedMs,
        timedOut: moveResult.timedOut
      });

      const san = buildSan(state, moveResult.move);
      pgnMoves.push({ moveNumber: state.fullmoveNumber, color: state.activeColor, san });
      const previousColor = state.activeColor;
      applyMove(state, moveResult.move);
      if (state.activeColor === previousColor) {
        throw new Error('Active color did not switch after move.');
      }
      plies += 1;
      lastMoveUci = moveToUci(moveResult.move);
      lastMoveSan = san;
    }
  } finally {
    engineWorker.terminate();
  }

  const final = finalizeGame(
    state,
    'draw',
    undefined,
    pgnMoves,
    options.white,
    options.round,
    options.hardMs,
    options.maxMs
  );
  const timings = summarizeTimings(moveTimings);
  return {
    ...final,
    plies,
    endReason: 'other',
    timings,
    log: {
      gameId: options.gameId,
      round: options.round,
      startedAt,
      finishedAt: new Date().toISOString(),
      hardMs: options.hardMs,
      maxMs: options.maxMs,
      whiteLabel: labelForSide(options.white),
      blackLabel: labelForSide(options.white === 'hard' ? 'max' : 'hard'),
      seed: options.seed,
      plies,
      finalFen: stateToFen(state),
      lastMoveUci,
      lastMoveSan,
      termination: {
        status: 'draw',
        trigger: 'ply_cap',
        message: `Reached ply cap (${options.maxPlies}).`
      },
      result: final.result,
      outcome: final.outcome,
      endReason: 'other',
      timings
    }
  };
}

async function pickEngineMove(
  state: GameState,
  options: {
    side: EngineSide;
    targetMs: number;
  },
  rng: () => number,
  worker: Worker
): Promise<{
  move: Move | null;
  worker: Worker;
  elapsedMs: number;
  timedOut: boolean;
  message?: string;
}> {
  const start = performance.now();
  const seed = Math.floor(rng() * 1000000000);
  const result = await runEngineWithTimeout(
    worker,
    state,
    {
      color: state.activeColor,
      difficulty: options.side,
      maxTimeMs: options.targetMs,
      maxDepth: options.side === 'max' ? MAX_THINKING_DEPTH_CAP : undefined,
      seed
    },
    options.targetMs,
    ENGINE_TIMEOUT_GRACE_MS
  );
  const elapsed = performance.now() - start;
  const timedOut = result.timedOut;
  if (result.error) {
    return {
      move: null,
      worker: result.worker,
      elapsedMs: elapsed,
      timedOut,
      message: result.error
    };
  }
  if (!result.move) {
    return {
      move: null,
      worker: result.worker,
      elapsedMs: elapsed,
      timedOut,
      message: 'Engine returned no move.'
    };
  }
  return {
    move: result.move,
    worker: result.worker,
    elapsedMs: elapsed,
    timedOut
  };
}

function finalizeGame(
  state: GameState,
  status: 'checkmate' | 'stalemate' | 'draw' | 'ongoing',
  winner: Color | undefined,
  moves: PgnMove[],
  whiteSide: EngineSide,
  round: number,
  hardMs: number,
  maxMs: number
): { result: string; outcome: 'win' | 'loss' | 'draw'; pgn: string } {
  let result = '1/2-1/2';
  if (status === 'checkmate' && winner) {
    result = winner === 'w' ? '1-0' : '0-1';
  } else if (status === 'stalemate') {
    result = '1/2-1/2';
  }

  const outcome = resolveOutcome(result, whiteSide);
  const pgn = buildSelfPlayPgn({
    moves,
    result,
    whiteSide,
    round,
    hardMs,
    maxMs
  });

  return { result, outcome, pgn };
}

function buildSelfPlayPgn(options: {
  moves: PgnMove[];
  result: string;
  whiteSide: EngineSide;
  round: number;
  hardMs: number;
  maxMs: number;
}): string {
  const date = new Date();
  const headerLines = [
    `[Event "Scorpion Self-Play"]`,
    `[Site "local"]`,
    `[Date "${formatPgnDate(date)}"]`,
    `[Round "${options.round}"]`,
    `[White "${labelForSide(options.whiteSide)}"]`,
    `[Black "${labelForSide(options.whiteSide === 'hard' ? 'max' : 'hard')}"]`,
    `[Result "${options.result}"]`,
    `[TimeControl "${options.hardMs}/${options.maxMs}"]`,
    `[Variant "Standard"]`
  ];
  const sanLine = buildSanLine(options.moves, options.result);
  return `${headerLines.join('\n')}\n\n${sanLine}\n`;
}

function buildSummary(args: {
  runId: string;
  startedAt: string;
  finishedAt: string;
  config: RunConfig;
  wins: number;
  draws: number;
  losses: number;
  totalPlies: number;
  endReasons: Record<string, number>;
  splits: {
    hardAsWhite: { wins: number; draws: number; losses: number };
    hardAsBlack: { wins: number; draws: number; losses: number };
  };
  timingTotals: {
    hard: { totalMs: number; maxMs: number; timeouts: number; moveCount: number };
    max: { totalMs: number; maxMs: number; timeouts: number; moveCount: number };
  };
}): RunSummary {
  const games = args.wins + args.draws + args.losses;
  const hardAvg = args.timingTotals.hard.moveCount
    ? args.timingTotals.hard.totalMs / args.timingTotals.hard.moveCount
    : 0;
  const maxAvg = args.timingTotals.max.moveCount
    ? args.timingTotals.max.totalMs / args.timingTotals.max.moveCount
    : 0;

  return {
    runId: args.runId,
    startedAt: args.startedAt,
    finishedAt: args.finishedAt,
    commitSha: resolveCommitSha(),
    config: {
      batchSize: args.config.batchSize,
      hardMs: args.config.hardMs,
      maxMs: args.config.maxMs,
      maxPlies: args.config.maxPlies,
      swap: args.config.swap,
      baseSeed: args.config.baseSeed,
      outDir: args.config.outDir ?? ROOT_OUTPUT_DIR
    },
    totals: {
      games,
      wins: args.wins,
      draws: args.draws,
      losses: args.losses,
      avgPlies: games > 0 ? args.totalPlies / games : 0,
      endReasons: args.endReasons
    },
    splits: {
      hardAsWhite: args.splits.hardAsWhite,
      hardAsBlack: args.splits.hardAsBlack
    },
    timing: {
      hard: {
        avgMs: hardAvg,
        maxMs: args.timingTotals.hard.maxMs,
        timeouts: args.timingTotals.hard.timeouts,
        moveCount: args.timingTotals.hard.moveCount
      },
      max: {
        avgMs: maxAvg,
        maxMs: args.timingTotals.max.maxMs,
        timeouts: args.timingTotals.max.timeouts,
        moveCount: args.timingTotals.max.moveCount
      }
    }
  };
}

function summarizeTimings(moveTimings: MoveTiming[]): { hard: SideTimings; max: SideTimings } {
  const totals = {
    hard: { totalMs: 0, maxMs: 0, timeouts: 0, moveCount: 0 },
    max: { totalMs: 0, maxMs: 0, timeouts: 0, moveCount: 0 }
  };
  for (const timing of moveTimings) {
    const bucket = totals[timing.side];
    bucket.totalMs += timing.ms;
    bucket.maxMs = Math.max(bucket.maxMs, timing.ms);
    bucket.moveCount += 1;
    if (timing.timedOut) {
      bucket.timeouts += 1;
    }
  }

  return {
    hard: {
      avgMs: totals.hard.moveCount ? totals.hard.totalMs / totals.hard.moveCount : 0,
      maxMs: totals.hard.maxMs,
      timeouts: totals.hard.timeouts,
      moveCount: totals.hard.moveCount
    },
    max: {
      avgMs: totals.max.moveCount ? totals.max.totalMs / totals.max.moveCount : 0,
      maxMs: totals.max.maxMs,
      timeouts: totals.max.timeouts,
      moveCount: totals.max.moveCount
    }
  };
}

function resolveOutcome(result: string, whiteSide: EngineSide): 'win' | 'loss' | 'draw' {
  if (result === '1/2-1/2') {
    return 'draw';
  }
  const whiteWon = result === '1-0';
  if (whiteSide === 'hard') {
    return whiteWon ? 'win' : 'loss';
  }
  return whiteWon ? 'loss' : 'win';
}

function labelForSide(side: EngineSide): string {
  return side === 'hard' ? 'Scorpion Hard' : 'Scorpion Max';
}

function buildRounds(batchSize: number, swap: boolean): { round: number; white: EngineSide }[] {
  const rounds: { round: number; white: EngineSide }[] = [];
  for (let i = 0; i < batchSize; i += 1) {
    rounds.push({ round: i + 1, white: 'hard' });
  }
  if (swap) {
    for (let i = 0; i < batchSize; i += 1) {
      rounds.push({ round: batchSize + i + 1, white: 'max' });
    }
  }
  return rounds;
}

function parseArgs(argv: string[]): {
  batchSize?: number;
  hardMs?: number;
  maxMs?: number;
  maxPlies?: number;
  swap?: boolean;
  outDir?: string;
  baseSeed?: number;
  runId?: string;
} {
  const result: {
    batchSize?: number;
    hardMs?: number;
    maxMs?: number;
    maxPlies?: number;
    swap?: boolean;
    outDir?: string;
    baseSeed?: number;
    runId?: string;
  } = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--batch' || arg === '--games') {
      result.batchSize = Number(argv[i + 1]);
      i += 1;
    } else if (arg === '--hardMs') {
      result.hardMs = Number(argv[i + 1]);
      i += 1;
    } else if (arg === '--maxMs') {
      result.maxMs = Number(argv[i + 1]);
      i += 1;
    } else if (arg === '--max-plies') {
      result.maxPlies = Number(argv[i + 1]);
      i += 1;
    } else if (arg === '--swap') {
      result.swap = true;
    } else if (arg === '--outDir') {
      result.outDir = argv[i + 1];
      i += 1;
    } else if (arg === '--seed') {
      result.baseSeed = Number(argv[i + 1]);
      i += 1;
    } else if (arg === '--runId') {
      result.runId = argv[i + 1];
      i += 1;
    }
  }
  return result;
}

function createSeededRng(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function categorizeEndReason(status: string, reason?: string): string {
  if (status === 'checkmate') {
    return 'mate';
  }
  if (status === 'stalemate') {
    return 'stalemate';
  }
  const reasonText = (reason ?? '').toLowerCase();
  if (reasonText.includes('threefold')) {
    return 'repetition';
  }
  if (reasonText.includes('50') || reasonText.includes('fifty')) {
    return 'fiftyMove';
  }
  return 'other';
}

async function updateReport(summary: RunSummary): Promise<void> {
  const text = await fs.readFile(REPORT_PATH, 'utf8');
  const start = '<!-- REPORT:START -->';
  const end = '<!-- REPORT:END -->';
  const startIndex = text.indexOf(start);
  const endIndex = text.indexOf(end);
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error('Report markers not found in SelfPlayReport.md');
  }
  const reportBody = buildReportBody(summary);
  const updated =
    text.slice(0, startIndex + start.length) +
    `\n${reportBody}\n` +
    text.slice(endIndex);
  await fs.writeFile(REPORT_PATH, updated, 'utf8');
}

function buildReportBody(summary: RunSummary): string {
  const totals = summary.totals;
  const avgPlies = totals.avgPlies.toFixed(1);
  const end = totals.endReasons;
  const hard = summary.timing.hard;
  const max = summary.timing.max;
  const lines = [
    `Last updated: ${summary.finishedAt}`,
    `Config: hardMs=${summary.config.hardMs}, maxMs=${summary.config.maxMs}, batch=${summary.config.batchSize}, swap=${summary.config.swap}`,
    `Commit: ${summary.commitSha}`,
    `Base seed: ${summary.config.baseSeed}`,
    `Output: ${summary.config.outDir}`,
    `Cumulative: ${totals.wins}-${totals.draws}-${totals.losses} (${totals.games} games)`,
    `Hard as White: ${summary.splits.hardAsWhite.wins}-${summary.splits.hardAsWhite.draws}-${summary.splits.hardAsWhite.losses}`,
    `Hard as Black: ${summary.splits.hardAsBlack.wins}-${summary.splits.hardAsBlack.draws}-${summary.splits.hardAsBlack.losses}`,
    `Avg plies per game: ${avgPlies}`,
    `End reasons: mate=${end.mate}, stalemate=${end.stalemate}, repetition=${end.repetition}, 50-move=${end.fiftyMove}, other=${end.other}`,
    `Timing (Hard): avg=${hard.avgMs.toFixed(1)}ms, max=${hard.maxMs.toFixed(1)}ms, timeouts=${hard.timeouts}`,
    `Timing (Max): avg=${max.avgMs.toFixed(1)}ms, max=${max.maxMs.toFixed(1)}ms, timeouts=${max.timeouts}`,
    '',
    'Notes:',
    '- Deterministic base seed used; move-level seeds derived from a fixed RNG.',
    '- SAN generation uses engine move legality; if SAN is missing for any move, check meta JSON.',
    ''
  ];
  return lines.join('\n');
}

function buildRunReadme(): string {
  return [
    '# Scorpion Self-Play Benchmarks',
    '',
    'This folder contains a single self-play run (Hard vs Max).',
    '',
    '## How to run',
    '- npm run bench:selfplay',
    '- Optional: --batch 10 --hardMs 800 --maxMs 10000 --swap --outDir <path> --seed 1000',
    '',
    '## Metrics',
    '- W/D/L: results from Hard (white default) vs Max (black default).',
    '- Color splits: Hard-as-White vs Hard-as-Black when using --swap.',
    '- Avg plies: total plies / games.',
    '- End reasons: mate, stalemate, repetition, 50-move, other.',
    '- Timing: per-side average and max move time, with timeout counts.',
    ''
  ].join('\n');
}

function resolveCommitSha(): string {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function formatRunId(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, '0');
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-` +
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

function formatPgnDate(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, '0');
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
}

function moveToUci(move: Move): string {
  const from = `${FILES[move.from.file]}${move.from.rank + 1}`;
  const to = `${FILES[move.to.file]}${move.to.rank + 1}`;
  const promo = move.promotion ? move.promotion[0] : '';
  return `${from}${to}${promo}`;
}

function uciToMove(state: GameState, uci: string): Move | null {
  if (uci.length < 4) {
    return null;
  }
  const from = parseSquare(uci.slice(0, 2));
  const to = parseSquare(uci.slice(2, 4));
  if (!from || !to) {
    return null;
  }
  const promotionChar = uci.length > 4 ? uci[4] : '';
  const promotion = promotionChar ? PROMO_MAP[promotionChar] : undefined;
  const moves = getAllLegalMoves(state, state.activeColor);
  return (
    moves.find(
      (move) =>
        move.from.file === from.file &&
        move.from.rank === from.rank &&
        move.to.file === to.file &&
        move.to.rank === to.rank &&
        move.promotion === promotion
    ) ?? null
  );
}

function parseSquare(value: string): { file: number; rank: number } | null {
  if (value.length !== 2) {
    return null;
  }
  const file = FILES.indexOf(value[0]);
  const rank = Number(value[1]) - 1;
  if (file < 0 || rank < 0 || rank > 7) {
    return null;
  }
  return { file, rank };
}

function applyOpening(
  state: GameState,
  opening: string[],
  moves: PgnMove[]
): { plies: number; lastMoveUci: string | null; lastMoveSan: string | null } {
  let plies = 0;
  let lastMoveUci: string | null = null;
  let lastMoveSan: string | null = null;
  for (const uci of opening) {
    const move = uciToMove(state, uci);
    if (!move) {
      break;
    }
    const san = buildSan(state, move);
    moves.push({ moveNumber: state.fullmoveNumber, color: state.activeColor, san });
    applyMove(state, move);
    plies += 1;
    lastMoveUci = uci;
    lastMoveSan = san;
  }
  return { plies, lastMoveUci, lastMoveSan };
}

function stateToFen(state: GameState): string {
  let board = '';
  for (let rank = 7; rank >= 0; rank -= 1) {
    let empty = 0;
    for (let file = 0; file < 8; file += 1) {
      const pieceId = state.board[rank][file];
      if (pieceId === null) {
        empty += 1;
        continue;
      }
      if (empty > 0) {
        board += empty.toString();
        empty = 0;
      }
      const piece = state.pieces.get(pieceId);
      if (!piece) {
        board += '1';
        continue;
      }
      board += pieceToChar(piece.type, piece.color);
    }
    if (empty > 0) {
      board += empty.toString();
    }
    if (rank > 0) {
      board += '/';
    }
  }

  const castling = serializeCastling(state);
  const enPassant = state.enPassantTarget
    ? `${FILES[state.enPassantTarget.file]}${state.enPassantTarget.rank + 1}`
    : '-';
  return `${board} ${state.activeColor} ${castling} ${enPassant} ${state.halfmoveClock} ${state.fullmoveNumber}`;
}

function pieceToChar(type: PieceType, color: Color): string {
  const map: Record<PieceType, string> = {
    pawn: 'p',
    knight: 'n',
    bishop: 'b',
    rook: 'r',
    queen: 'q',
    king: 'k'
  };
  const char = map[type] ?? 'p';
  return color === 'w' ? char.toUpperCase() : char;
}

function serializeCastling(state: GameState): string {
  let value = '';
  if (state.castlingRights.wK) value += 'K';
  if (state.castlingRights.wQ) value += 'Q';
  if (state.castlingRights.bK) value += 'k';
  if (state.castlingRights.bQ) value += 'q';
  return value || '-';
}

function createEngineWorker(): Worker {
  return new Worker(new URL('./engineWorker.cjs', import.meta.url));
}

async function runEngineWithTimeout(
  worker: Worker,
  state: GameState,
  options: {
    color: Color;
    difficulty: EngineSide;
    maxTimeMs?: number;
    maxDepth?: number;
    seed: number;
  },
  targetMs: number,
  graceMs: number
): Promise<{
  move: Move | null;
  error?: string;
  worker: Worker;
  timedOut: boolean;
}> {
  let activeWorker = worker;
  const requestId = Math.floor(Math.random() * 1e9);
  let timedOut = false;

  const result = await new Promise<{
    move: Move | null;
    error?: string;
    worker: Worker;
    timedOut: boolean;
  }>((resolve) => {
    const attachedWorker = activeWorker;
    const stopTimer = setTimeout(() => {
      attachedWorker.postMessage({ kind: 'stop', id: requestId });
    }, targetMs);

    const timeout = setTimeout(() => {
      timedOut = true;
      cleanup();
      attachedWorker.terminate();
      activeWorker = createEngineWorker();
      resolve({ move: fallbackMove(state), worker: activeWorker, timedOut });
    }, targetMs + graceMs);

    const cleanup = () => {
      clearTimeout(stopTimer);
      clearTimeout(timeout);
      attachedWorker.off('message', onMessage);
      attachedWorker.off('error', onError);
    };

    const onMessage = (response: { id: number; move: Move | null; error?: string }) => {
      if (response.id !== requestId) {
        return;
      }
      cleanup();
      resolve({
        move: response.move,
        error: response.error,
        worker: activeWorker,
        timedOut
      });
    };

    const onError = (error: unknown) => {
      cleanup();
      attachedWorker.terminate();
      activeWorker = createEngineWorker();
      resolve({
        move: null,
        error: error instanceof Error ? error.message : String(error),
        worker: activeWorker,
        timedOut
      });
    };

    attachedWorker.on('message', onMessage);
    attachedWorker.on('error', onError);

    attachedWorker.postMessage({
      id: requestId,
      state,
      color: options.color,
      options
    });
  });

  return result;
}

function fallbackMove(state: GameState): Move | null {
  const moves = getAllLegalMoves(state, state.activeColor);
  if (moves.length === 0) {
    return null;
  }
  return moves[0];
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
