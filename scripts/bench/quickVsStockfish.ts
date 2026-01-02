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
  getGameStatus,
  getPositionKey
} from '../../src/rules';
import { buildPgn, buildSan, PgnMove } from '../../src/pgn/pgn';
import { MAX_THINKING_DEPTH_CAP } from '../../src/ai/ai';
import { StockfishClient } from './uciStockfish';

type EngineMode = 'hard' | 'max';

type RunConfig = {
  stockfishPath: string;
  batchSize: number;
  movetimeMs: number;
  stockfishMovetimes: number[];
  mode: EngineMode;
  threads: number;
  hashMb: number;
  ponder: boolean;
  maxPlies: number;
  swap: boolean;
  fenSuite: boolean;
  baseSeed: number;
  outDir: string;
};

type BatchResult = {
  batchIndex: number;
  startedAt: string;
  finishedAt: string;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  score: number;
  eloDelta: number | null;
  eloLow: number | null;
  eloHigh: number | null;
  avgPlies: number;
  endReasons: Record<string, number>;
  engineTargetMs: number;
  stockfishTargetMs: number;
  engineTimeouts: number;
  stockfishTimeouts: number;
  engineOverheadCount: number;
  engineStopLatencyAvg: number;
  avgEngineMs: number;
  avgStockfishMs: number;
  engineMoveCount: number;
  engineTimedOutMoves: number;
  engineNonTimeoutTotalMs: number;
  engineTimeoutTotalMs: number;
  engineNonTimeoutMaxMs: number;
  engineTimeoutMaxMs: number;
};

type TerminationTrigger =
  | 'engine_status'
  | 'ply_cap'
  | 'missing_bestmove'
  | 'invalid_bestmove'
  | 'engine_worker_error'
  | 'engine_timeout_fallback'
  | 'stockfish_timeout'
  | 'early_draw'
  | 'apply_move_error';

type MoveTiming = {
  ply: number;
  color: Color;
  source: 'engine' | 'stockfish';
  ms: number;
  timedOut: boolean;
  allocatedMs?: number;
  depth?: number;
  nodes?: number;
  nps?: number;
  cutoffs?: number;
  fallbackUsed?: boolean;
  earlyExitUsed?: boolean;
  softStopUsed?: boolean;
  hardStopUsed?: boolean;
  stopReason?: 'none' | 'pre_iter_gate' | 'mid_search_deadline' | 'external_cancel';
};

type GameLog = {
  gameId: number;
  mode: EngineMode;
  engineColor: Color;
  engineLabel: string;
  opening: string[] | null;
  startFen: string | null;
  seed: number;
  plies: number;
  finalFen: string;
  lastMoveUci: string | null;
  lastMoveSan: string | null;
  termination: {
    trigger: TerminationTrigger;
    status?: string;
    reason?: string;
    message?: string;
  };
  moveTimings: MoveTiming[];
  result?: string;
  outcome?: 'win' | 'loss' | 'draw';
};

type RunState = {
  startedAt: string;
  updatedAt: string;
  seriesLabel?: string;
  config: {
    stockfishPath: string;
    movetimeMs: number;
    stockfishMovetimes: number[];
    mode: EngineMode;
    threads: number;
    hashMb: number;
    ponder: boolean;
    maxPlies: number;
    swap: boolean;
    fenSuite: boolean;
    baseSeed: number;
    outDir: string;
  };
  totalGames: number;
  wins: number;
  draws: number;
  losses: number;
  nextOpening: number;
  stockfishRungIndex: number;
  batches: BatchResult[];
};

class BenchmarkError extends Error {
  constructor(
    message: string,
    public details: GameLog
  ) {
    super(message);
  }
}

const ROOT_OUTPUT_DIR = path.resolve('scripts/bench/quick-results');
const STATE_PATH = path.resolve('scripts/bench/quick-run-state.json');
const REPORT_PATH = path.resolve('docs/ScorpionChessEngineVsStockfishReport.md');

const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_MOVETIME_MS = 100;
const DEFAULT_MODE: EngineMode = 'max';
const DEFAULT_THREADS = 1;
const DEFAULT_HASH_MB = 64;
const DEFAULT_MAX_PLIES = 200;
const DEFAULT_BASE_SEED = 1000;
const DEFAULT_SWAP = false;
const DEFAULT_FEN_SUITE = false;
const DEFAULT_STOCKFISH_LADDER = '100,50,20,10,5';
// Extra slack absorbs stop latency and OS scheduling jitter; it doesn't change engine budgets.
const TIMEOUT_TOLERANCE_BUMP_MS = 25;
const ENGINE_TIMEOUT_GRACE_MS = 80 + TIMEOUT_TOLERANCE_BUMP_MS;
const STOCKFISH_TIMEOUT_SLACK_MS = 20 + TIMEOUT_TOLERANCE_BUMP_MS;
const MIN_PLIES_FOR_DRAW = 2;
const REPORT_WARNING_MIN_PLIES = 10;
const DEFAULT_SERIES_LABEL = 'Post-fix baseline series';

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

const FEN_SEED_OPENINGS: string[][] = [
  ['e2e4', 'e7e5', 'f2f4', 'e5f4', 'g1f3', 'g7g5', 'h2h4', 'g5g4'],
  ['d2d4', 'd7d5', 'c2c4', 'd5c4', 'e2e3', 'b7b5', 'a2a4', 'c7c6'],
  ['e2e4', 'c7c5', 'b2b4', 'c5b4', 'a2a3', 'b4a3', 'b1c3', 'd7d6'],
  ['e2e4', 'c7c6', 'd2d4', 'd7d5', 'e4d5', 'c6d5', 'c2c4', 'g8f6'],
  ['e2e4', 'd7d5', 'e4d5', 'd8d5', 'b1c3', 'd5a5', 'd2d4', 'c7c6'],
  ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5c6', 'd7c6'],
  ['e2e4', 'e7e5', 'd2d4', 'e5d4', 'c2c3', 'd4c3', 'b1c3', 'd7d5'],
  ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'e4e5', 'c7c5', 'c2c3', 'b8c6'],
  ['d2d4', 'f7f5', 'c2c4', 'g8f6', 'b1c3', 'e7e6', 'g1f3', 'f8b4'],
  ['d2d4', 'g8f6', 'c2c4', 'g7g6', 'b1c3', 'f8g7', 'e2e4', 'd7d6'],
  ['e2e4', 'g8f6', 'e4e5', 'f6d5', 'd2d4', 'd7d6', 'g1f3', 'g7g6'],
  ['d2d4', 'd7d5', 'c2c4', 'c7c6', 'b1c3', 'g8f6', 'c4d5', 'c6d5']
];

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const PROMO_MAP: Record<string, PieceType> = {
  q: 'queen',
  r: 'rook',
  b: 'bishop',
  n: 'knight'
};

const FEN_SUITE = buildFenSuite(FEN_SEED_OPENINGS);

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.stockfishPath) {
    console.error('Missing --stockfish path.');
    process.exitCode = 1;
    return;
  }

  const runId = args.runId ?? formatRunId(new Date());
  const outDir = args.outDir ?? path.join(ROOT_OUTPUT_DIR, `run-${runId}`);
  const commandLine = process.argv.join(' ');
  const commitSha = resolveCommitSha();
  const stockfishMovetimes =
    args.stockfishLadder ??
    [args.stockfishMovetime ?? args.movetimeMs ?? DEFAULT_MOVETIME_MS];

  const config: RunConfig = {
    stockfishPath: args.stockfishPath,
    batchSize: args.batchSize ?? DEFAULT_BATCH_SIZE,
    movetimeMs: args.movetimeMs ?? DEFAULT_MOVETIME_MS,
    stockfishMovetimes,
    mode: args.mode ?? DEFAULT_MODE,
    threads: args.threads ?? DEFAULT_THREADS,
    hashMb: args.hashMb ?? DEFAULT_HASH_MB,
    ponder: false,
    maxPlies: args.maxPlies ?? DEFAULT_MAX_PLIES,
    swap: args.swap ?? DEFAULT_SWAP,
    fenSuite: args.fenSuite ?? DEFAULT_FEN_SUITE,
    baseSeed: args.baseSeed ?? DEFAULT_BASE_SEED,
    outDir
  };

  const state = await loadRunState(config, args.reset, args.seriesLabel);
  await fs.mkdir(outDir, { recursive: true });
  await fs.mkdir(ROOT_OUTPUT_DIR, { recursive: true });

  if (config.batchSize <= 0) {
    await updateReport(state, config, { commitSha, commandLine });
    console.log('Report refreshed (no games played).');
    return;
  }

  const stockfish = new StockfishClient({
    path: config.stockfishPath,
    threads: config.threads,
    hashMb: config.hashMb,
    ponder: config.ponder
  });
  await stockfish.init();

  const batchStart = new Date().toISOString();
  let batchWins = 0;
  let batchDraws = 0;
  let batchLosses = 0;
  const engineTimes: number[] = [];
  const stockfishTimes: number[] = [];
  const engineStopLatencies: number[] = [];
  let engineOverheadCount = 0;
  let engineTimeouts = 0;
  let engineMoveCount = 0;
  let engineTimedOutMoves = 0;
  let engineNonTimeoutTotalMs = 0;
  let engineTimeoutTotalMs = 0;
  let engineNonTimeoutMaxMs = 0;
  let engineTimeoutMaxMs = 0;
  let stockfishTimeouts = 0;
  let batchPlies = 0;
  const endReasons: Record<string, number> = {
    mate: 0,
    stalemate: 0,
    repetition: 0,
    fiftyMove: 0,
    other: 0
  };
  const stockfishMovetimeMs =
    config.stockfishMovetimes[state.stockfishRungIndex] ??
    config.stockfishMovetimes[config.stockfishMovetimes.length - 1];

  const gamesToPlay = config.swap ? config.batchSize * 2 : config.batchSize;

  for (let gameIndex = 0; gameIndex < gamesToPlay; gameIndex += 1) {
    const openingIndex = config.swap ? Math.floor(state.totalGames / 2) : state.totalGames;
    const start = selectStartPosition(config, openingIndex);
    const engineColor: Color = state.totalGames % 2 === 0 ? 'w' : 'b';
    const seed = config.baseSeed + state.totalGames;
    const gameId = state.totalGames + 1;

    const engineLabel = config.mode === 'max' ? 'Scorpion (Max Thinking)' : 'Scorpion (Hard)';
    let result: Awaited<ReturnType<typeof runSingleGame>>;
    try {
      result = await runSingleGame({
        gameId,
        opening: start.opening,
        startFen: start.fen,
        engineColor,
        movetimeMs: config.movetimeMs,
        stockfishMovetimeMs,
        mode: config.mode,
        seed,
        maxPlies: config.maxPlies,
        stockfish,
        engineLabel,
        engineTimes,
        stockfishTimes,
        onEngineStopLatency: (latency) => {
          if (latency !== null) {
            engineStopLatencies.push(latency);
            if (latency > 0) {
              engineOverheadCount += 1;
            }
          }
        },
        onEngineTimeout: () => {
          engineTimeouts += 1;
        },
        onEngineMoveTiming: (ms, timedOut) => {
          engineMoveCount += 1;
          if (timedOut) {
            engineTimedOutMoves += 1;
            engineTimeoutTotalMs += ms;
            engineTimeoutMaxMs = Math.max(engineTimeoutMaxMs, ms);
          } else {
            engineNonTimeoutTotalMs += ms;
            engineNonTimeoutMaxMs = Math.max(engineNonTimeoutMaxMs, ms);
          }
        },
        onStockfishTimeout: () => {
          stockfishTimeouts += 1;
        }
      });
    } catch (error) {
      await writeGameError(outDir, {
        gameId,
        engineColor,
        engineLabel,
        mode: config.mode,
        opening: start.opening,
        startFen: start.fen,
        seed,
        error
      });
      throw error;
    }
    batchPlies += result.plies;
    endReasons[result.endReason] = (endReasons[result.endReason] ?? 0) + 1;

    state.totalGames += 1;
    state.nextOpening = config.swap ? Math.floor(state.totalGames / 2) : state.totalGames;
    state.updatedAt = new Date().toISOString();
    if (result.outcome === 'win') {
      state.wins += 1;
      batchWins += 1;
    } else if (result.outcome === 'loss') {
      state.losses += 1;
      batchLosses += 1;
    } else {
      state.draws += 1;
      batchDraws += 1;
    }

    await fs.writeFile(
      path.join(outDir, `game-${state.totalGames.toString().padStart(4, '0')}.pgn`),
      result.pgn,
      'utf8'
    );
    await writeGameLog(outDir, result.log);
    await saveRunState(state);
    console.log(`Game ${state.totalGames}: ${result.result} (${result.outcome})`);
  }

  stockfish.quit();

  const batchFinished = new Date().toISOString();
  const batchStats = buildBatchResult({
    batchIndex: state.batches.length + 1,
    startedAt: batchStart,
    finishedAt: batchFinished,
    wins: batchWins,
    draws: batchDraws,
    losses: batchLosses,
    totalPlies: batchPlies,
    endReasons,
    engineTargetMs: config.movetimeMs,
    stockfishTargetMs: stockfishMovetimeMs,
    engineTimeouts,
    stockfishTimeouts,
    engineOverheadCount,
    engineStopLatencies,
    engineTimes,
    stockfishTimes,
    engineMoveCount,
    engineTimedOutMoves,
    engineNonTimeoutTotalMs,
    engineTimeoutTotalMs,
    engineNonTimeoutMaxMs,
    engineTimeoutMaxMs
  });

  state.batches.push(batchStats);
  // Ladder progression is paused until timeout rates and termination validity are verified.
  state.updatedAt = batchFinished;
  await saveRunState(state);
  await updateReport(state, config, { commitSha, commandLine });
  await writeRunSummary(state, config, { commitSha, commandLine });

  console.log(
    `Batch complete: ${batchStats.wins}-${batchStats.draws}-${batchStats.losses} ` +
      `(score ${batchStats.score.toFixed(3)}, Elo ${formatElo(batchStats.eloDelta)})`
  );
  console.log('Run the script again to play the next batch.');
}

async function runSingleGame(options: {
  gameId: number;
  opening: string[] | null;
  startFen: string | null;
  engineColor: Color;
  movetimeMs: number;
  stockfishMovetimeMs: number;
  mode: EngineMode;
  seed: number;
  maxPlies: number;
  stockfish: StockfishClient;
  engineLabel: string;
  engineTimes: number[];
  stockfishTimes: number[];
  onEngineStopLatency: (latency: number | null) => void;
  onEngineTimeout: () => void;
  onEngineMoveTiming: (ms: number, timedOut: boolean) => void;
  onStockfishTimeout: () => void;
}): Promise<{
  result: string;
  outcome: 'win' | 'loss' | 'draw';
  pgn: string;
  plies: number;
  endReason: string;
  log: GameLog;
}> {
  const state = options.startFen ? createStateFromFen(options.startFen) : createInitialState();
  const pgnMoves: PgnMove[] = [];
  const moveTimings: MoveTiming[] = [];
  let lastMoveUci: string | null = null;
  let lastMoveSan: string | null = null;
  let plies = 0;
  let startFen = options.startFen ?? null;
  if (!options.startFen && options.opening && options.opening.length > 0) {
    const openingResult = applyOpening(state, options.opening, pgnMoves);
    plies = openingResult.plies;
    lastMoveUci = openingResult.lastMoveUci;
    lastMoveSan = openingResult.lastMoveSan;
    startFen = stateToFen(state);
  }
  const rng = createSeededRng(options.seed);
  let engineWorker = createEngineWorker();

  try {
    while (plies < options.maxPlies) {
      const status = getGameStatus(state);
      if (status.status === 'checkmate' || status.status === 'stalemate' || status.status === 'draw') {
        if (plies < MIN_PLIES_FOR_DRAW && status.status !== 'checkmate') {
          throw new BenchmarkError('Game ended before minimum plies.', {
            gameId: options.gameId,
            mode: options.mode,
            engineColor: options.engineColor,
            engineLabel: options.engineLabel,
            opening: options.opening,
            startFen,
            seed: options.seed,
            plies,
            finalFen: stateToFen(state),
            lastMoveUci,
            lastMoveSan,
            moveTimings,
            termination: {
              trigger: 'early_draw',
              status: status.status,
              reason: status.reason
            }
          });
        }
        const endReason = categorizeEndReason(status.status, status.reason);
        const final = finalizeGame(
          state,
          status.status,
          status.winner,
          pgnMoves,
          options.engineColor,
          options.engineLabel
        );
        return {
          ...final,
          plies,
          endReason,
          log: {
            gameId: options.gameId,
            mode: options.mode,
            engineColor: options.engineColor,
            engineLabel: options.engineLabel,
            opening: options.opening,
            startFen,
            seed: options.seed,
            plies,
            finalFen: stateToFen(state),
            lastMoveUci,
            lastMoveSan,
            moveTimings,
            termination: {
              trigger: 'engine_status',
              status: status.status,
              reason: status.reason
            },
            result: final.result,
            outcome: final.outcome
          }
        };
      }

      const move =
        state.activeColor === options.engineColor
          ? await pickEngineMove(
              state,
              options,
              rng,
              options.engineTimes,
              options.onEngineStopLatency,
              options.onEngineTimeout,
              engineWorker
            )
          : await pickStockfishMove(
              state,
              options,
              options.stockfishTimes,
              options.onStockfishTimeout
            );

      if (move.worker) {
        engineWorker = move.worker;
      }

      if (!move.move) {
        throw new BenchmarkError('Move selection failed.', {
          gameId: options.gameId,
          mode: options.mode,
          engineColor: options.engineColor,
          engineLabel: options.engineLabel,
          opening: options.opening,
          startFen,
          seed: options.seed,
          plies,
          finalFen: stateToFen(state),
          lastMoveUci,
          lastMoveSan,
          moveTimings,
          termination: {
            trigger: move.trigger ?? 'missing_bestmove',
            message: move.message
          }
        });
      }

      if (move.source === 'engine') {
        options.onEngineMoveTiming(move.elapsedMs, move.timedOut);
      }

      moveTimings.push({
        ply: plies + 1,
        color: state.activeColor,
        source: move.source,
        ms: move.elapsedMs,
        timedOut: move.timedOut,
        allocatedMs: move.source === 'engine' ? options.movetimeMs : options.stockfishMovetimeMs,
        depth:
          move.source === 'engine' && move.meta
            ? (move.meta as { searchMetrics?: { depthCompleted?: number } }).searchMetrics
                ?.depthCompleted
            : undefined,
        nodes:
          move.source === 'engine' && move.meta
            ? (move.meta as { searchMetrics?: { nodes?: number } }).searchMetrics?.nodes
            : undefined,
        nps:
          move.source === 'engine' && move.meta
            ? (move.meta as { searchMetrics?: { nps?: number } }).searchMetrics?.nps
            : undefined,
        cutoffs:
          move.source === 'engine' && move.meta
            ? (move.meta as { searchMetrics?: { cutoffs?: number } }).searchMetrics?.cutoffs
            : undefined,
        fallbackUsed:
          move.timedOut ||
          (move.source === 'engine' &&
            move.meta &&
            (move.meta as { searchMetrics?: { fallbackUsed?: boolean } }).searchMetrics
              ?.fallbackUsed) ||
          false,
        earlyExitUsed:
          move.source === 'engine' && move.meta
            ? (move.meta as { stopRequested?: boolean }).stopRequested === true
            : undefined,
        softStopUsed:
          move.source === 'engine' && move.meta
            ? (move.meta as { searchMetrics?: { softStopUsed?: boolean } }).searchMetrics
                ?.softStopUsed
            : undefined,
        hardStopUsed:
          move.source === 'engine' && move.meta
            ? (move.meta as { searchMetrics?: { hardStopUsed?: boolean } }).searchMetrics
                ?.hardStopUsed
            : undefined,
        stopReason:
          move.source === 'engine' && move.meta
            ? (move.meta as { searchMetrics?: { stopReason?: MoveTiming['stopReason'] } })
                .searchMetrics?.stopReason
            : undefined
      });

      const san = buildSan(state, move.move);
      pgnMoves.push({ moveNumber: state.fullmoveNumber, color: state.activeColor, san });
      const previousColor = state.activeColor;
      applyMove(state, move.move);
      if (state.activeColor === previousColor) {
        throw new BenchmarkError('Active color did not switch after move.', {
          gameId: options.gameId,
          mode: options.mode,
          engineColor: options.engineColor,
          engineLabel: options.engineLabel,
          opening: options.opening,
          plies,
          finalFen: stateToFen(state),
          lastMoveUci,
          lastMoveSan,
          moveTimings,
          termination: {
            trigger: 'apply_move_error',
            message: 'Active color did not switch after applyMove.'
          }
        });
      }
      plies += 1;
      lastMoveUci = moveToUci(move.move);
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
    options.engineColor,
    options.engineLabel
  );
  return {
    ...final,
    plies,
    endReason: 'other',
    log: {
      gameId: options.gameId,
      mode: options.mode,
      engineColor: options.engineColor,
      engineLabel: options.engineLabel,
      opening: options.opening,
      startFen,
      seed: options.seed,
      plies,
      finalFen: stateToFen(state),
      lastMoveUci,
      lastMoveSan,
      moveTimings,
      termination: {
        trigger: 'ply_cap',
        message: `Reached ply cap (${options.maxPlies}).`
      },
      result: final.result,
      outcome: final.outcome
    }
  };
}

async function pickEngineMove(
  state: GameState,
  options: {
    movetimeMs: number;
    mode: EngineMode;
  },
  rng: () => number,
  timings: number[],
  onStopLatency: (latency: number | null) => void,
  onTimeout: () => void,
  worker: Worker
): Promise<{
  move: Move | null;
  trigger?: TerminationTrigger;
  message?: string;
  worker: Worker;
  elapsedMs: number;
  timedOut: boolean;
  source: 'engine';
  meta?: { [key: string]: unknown };
}> {
  const start = performance.now();
  const seed = Math.floor(rng() * 1000000000);
  const result = await runEngineWithTimeout(
    worker,
    state,
    {
      color: state.activeColor,
      difficulty: options.mode,
      maxTimeMs: options.movetimeMs,
      maxDepth: options.mode === 'max' ? MAX_THINKING_DEPTH_CAP : undefined,
      seed,
      instrumentation: true
    },
    options.movetimeMs,
    ENGINE_TIMEOUT_GRACE_MS,
    onStopLatency,
    onTimeout
  );
  const elapsed = performance.now() - start;
  timings.push(elapsed);
  const timedOut = result.timedOut;
  if (result.error) {
    return {
      move: null,
      trigger: 'engine_worker_error',
      message: result.error,
      worker: result.worker,
      elapsedMs: elapsed,
      timedOut,
      source: 'engine',
      meta: result.meta
    };
  }
  if (!result.move) {
    return {
      move: null,
      trigger: 'missing_bestmove',
      message: 'Engine returned no move.',
      worker: result.worker,
      elapsedMs: elapsed,
      timedOut,
      source: 'engine',
      meta: result.meta
    };
  }
  return {
    move: result.move,
    worker: result.worker,
    elapsedMs: elapsed,
    timedOut,
    source: 'engine',
    meta: result.meta
  };
}

async function pickStockfishMove(
  state: GameState,
  options: { stockfishMovetimeMs: number; stockfish: StockfishClient },
  timings: number[],
  onTimeout: () => void
): Promise<{
  move: Move | null;
  trigger?: TerminationTrigger;
  message?: string;
  elapsedMs: number;
  timedOut: boolean;
  source: 'stockfish';
}> {
  const fen = stateToFen(state);
  const start = performance.now();
  const timeoutMs = options.stockfishMovetimeMs + STOCKFISH_TIMEOUT_SLACK_MS;
  let timedOut = false;
  const stopTimer = setTimeout(() => {
    options.stockfish.stopSearch();
  }, options.stockfishMovetimeMs);
  const timeout = setTimeout(() => {
    timedOut = true;
    options.stockfish.stopSearch();
  }, timeoutMs);
  const best = await options.stockfish.getBestMove(fen, options.stockfishMovetimeMs);
  clearTimeout(stopTimer);
  clearTimeout(timeout);
  const elapsed = performance.now() - start;
  timings.push(elapsed);
  if (timedOut) {
    onTimeout();
  }
  if (!best) {
    return {
      move: null,
      trigger: timedOut ? 'stockfish_timeout' : 'missing_bestmove',
      message: timedOut ? 'Stockfish timed out before bestmove.' : 'Stockfish returned no bestmove.',
      elapsedMs: elapsed,
      timedOut,
      source: 'stockfish'
    };
  }
  const move = uciToMove(state, best);
  if (!move) {
    return {
      move: null,
      trigger: 'invalid_bestmove',
      message: `Stockfish bestmove not legal: ${best}`,
      elapsedMs: elapsed,
      timedOut,
      source: 'stockfish'
    };
  }
  return { move, elapsedMs: elapsed, timedOut, source: 'stockfish' };
}

function finalizeGame(
  state: GameState,
  status: 'checkmate' | 'stalemate' | 'draw' | 'ongoing',
  winner: Color | undefined,
  moves: PgnMove[],
  engineColor: Color,
  engineLabel: string
): { result: string; outcome: 'win' | 'loss' | 'draw'; pgn: string } {
  let result = '1/2-1/2';
  if (status === 'checkmate') {
    result = winner === 'w' ? '1-0' : '0-1';
  }
  const outcome =
    result === '1/2-1/2'
      ? 'draw'
      : engineColor === 'w'
      ? result === '1-0'
        ? 'win'
        : 'loss'
      : result === '0-1'
      ? 'win'
      : 'loss';
  const pgn = buildPgn({
    moves,
    white: engineColor === 'w' ? engineLabel : 'Stockfish',
    black: engineColor === 'b' ? engineLabel : 'Stockfish',
    result,
    event: 'Scorpion vs Stockfish (Quick)',
    site: 'Local',
    date: new Date()
  });
  return { result, outcome, pgn };
}

async function writeGameLog(outDir: string, log: GameLog): Promise<void> {
  const filename = `game-${log.gameId.toString().padStart(4, '0')}-meta.json`;
  await fs.writeFile(path.join(outDir, filename), JSON.stringify(log, null, 2), 'utf8');
}

async function writeGameError(
  outDir: string,
  args: {
  gameId: number;
  engineColor: Color;
  engineLabel: string;
  mode: EngineMode;
  opening: string[] | null;
  startFen: string | null;
  seed: number;
  error: unknown;
}): Promise<void> {
  const filename = `game-${args.gameId.toString().padStart(4, '0')}-error.json`;
  const details =
    args.error instanceof BenchmarkError
      ? args.error.details
      : ({
          gameId: args.gameId,
          mode: args.mode,
          engineColor: args.engineColor,
          engineLabel: args.engineLabel,
          opening: args.opening,
          startFen: args.startFen,
          seed: args.seed,
          plies: 0,
          finalFen: 'unknown',
          lastMoveUci: null,
          lastMoveSan: null,
          moveTimings: [],
          termination: {
            trigger: 'missing_bestmove',
            message: args.error instanceof Error ? args.error.message : String(args.error)
          }
        } satisfies GameLog);
  const payload = {
    error: args.error instanceof Error ? args.error.message : String(args.error),
    details
  };
  await fs.writeFile(path.join(outDir, filename), JSON.stringify(payload, null, 2), 'utf8');
}

function applyOpening(
  state: GameState,
  moves: string[],
  pgnMoves: PgnMove[]
): { plies: number; lastMoveUci: string | null; lastMoveSan: string | null } {
  let plies = 0;
  let lastMoveUci: string | null = null;
  let lastMoveSan: string | null = null;
  for (const uci of moves) {
    const move = uciToMove(state, uci);
    if (!move) {
      throw new Error(`Invalid opening move: ${uci}`);
    }
    const san = buildSan(state, move);
    pgnMoves.push({ moveNumber: state.fullmoveNumber, color: state.activeColor, san });
    applyMove(state, move);
    plies += 1;
    lastMoveUci = uci;
    lastMoveSan = san;
  }
  return { plies, lastMoveUci, lastMoveSan };
}

function pickOpening(baseSeed: number, index: number): string[] {
  if (OPENINGS.length === 0) {
    return [];
  }
  const resolved = Math.abs(baseSeed + index) % OPENINGS.length;
  return OPENINGS[resolved];
}

function pickFen(baseSeed: number, index: number): string | null {
  if (FEN_SUITE.length === 0) {
    return null;
  }
  const resolved = Math.abs(baseSeed + index) % FEN_SUITE.length;
  return FEN_SUITE[resolved];
}

function selectStartPosition(
  config: RunConfig,
  openingIndex: number
): { fen: string | null; opening: string[] | null } {
  if (config.fenSuite && FEN_SUITE.length > 0) {
    return { fen: pickFen(config.baseSeed, openingIndex), opening: null };
  }
  return { fen: null, opening: pickOpening(config.baseSeed, openingIndex) };
}

function buildFenSuite(sequences: string[][]): string[] {
  const fens: string[] = [];
  for (const sequence of sequences) {
    const state = createInitialState();
    let valid = true;
    for (const uci of sequence) {
      const move = uciToMove(state, uci);
      if (!move) {
        valid = false;
        break;
      }
      applyMove(state, move);
    }
    if (valid) {
      fens.push(stateToFen(state));
    }
  }
  return fens;
}

function uciToMove(state: GameState, uci: string): Move | null {
  if (uci.length < 4) {
    return null;
  }
  const from = algebraicToSquare(uci.slice(0, 2));
  const to = algebraicToSquare(uci.slice(2, 4));
  const promotion = uci.length > 4 ? PROMO_MAP[uci[4]] : undefined;
  if (!from || !to) {
    return null;
  }
  const legalMoves = getAllLegalMoves(state, state.activeColor);
  return (
    legalMoves.find((move) => {
      if (move.from.file !== from.file || move.from.rank !== from.rank) {
        return false;
      }
      if (move.to.file !== to.file || move.to.rank !== to.rank) {
        return false;
      }
      if (promotion && move.promotion !== promotion) {
        return false;
      }
      if (!promotion && move.promotion) {
        return false;
      }
      return true;
    }) ?? null
  );
}

function moveToUci(move: Move): string {
  const from = `${FILES[move.from.file]}${move.from.rank + 1}`;
  const to = `${FILES[move.to.file]}${move.to.rank + 1}`;
  const promo = move.promotion ? move.promotion[0] : '';
  return `${from}${to}${promo}`;
}

function algebraicToSquare(text: string): { file: number; rank: number } | null {
  if (text.length !== 2) {
    return null;
  }
  const file = FILES.indexOf(text[0]);
  const rank = Number(text[1]) - 1;
  if (file < 0 || rank < 0 || rank > 7) {
    return null;
  }
  return { file, rank };
}

function stateToFen(state: GameState): string {
  let board = '';
  for (let rank = 7; rank >= 0; rank -= 1) {
    let empty = 0;
    for (let file = 0; file < 8; file += 1) {
      const id = state.board[rank][file];
      if (!id) {
        empty += 1;
        continue;
      }
      if (empty > 0) {
        board += empty.toString();
        empty = 0;
      }
      const piece = state.pieces.get(id);
      board += piece ? pieceToChar(piece.type, piece.color) : '1';
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

function createStateFromFen(fen: string): GameState {
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 4) {
    throw new Error(`Invalid FEN: ${fen}`);
  }
  const [boardPart, activeColorRaw, castlingRaw, enPassantRaw, halfmoveRaw, fullmoveRaw] =
    parts;
  const board = Array.from({ length: 8 }, () => Array(8).fill(null)) as (number | null)[][];
  const pieces = new Map<number, { id: number; type: PieceType; color: Color; hasMoved: boolean }>();
  let nextId = 1;
  const ranks = boardPart.split('/');
  if (ranks.length !== 8) {
    throw new Error(`Invalid FEN board: ${fen}`);
  }

  for (let fenRank = 0; fenRank < 8; fenRank += 1) {
    const rank = 7 - fenRank;
    let file = 0;
    for (const char of ranks[fenRank]) {
      if (char >= '1' && char <= '8') {
        file += Number(char);
        continue;
      }
      const piece = fenCharToPiece(char);
      if (!piece) {
        throw new Error(`Invalid FEN piece: ${fen}`);
      }
      if (file > 7) {
        throw new Error(`Invalid FEN file: ${fen}`);
      }
      pieces.set(nextId, { id: nextId, ...piece, hasMoved: false });
      board[rank][file] = nextId;
      nextId += 1;
      file += 1;
    }
    if (file !== 8) {
      throw new Error(`Invalid FEN rank width: ${fen}`);
    }
  }

  const activeColor = activeColorRaw === 'b' ? 'b' : 'w';
  const castlingRights = {
    wK: castlingRaw.includes('K'),
    wQ: castlingRaw.includes('Q'),
    bK: castlingRaw.includes('k'),
    bQ: castlingRaw.includes('q')
  };
  const enPassantTarget =
    enPassantRaw && enPassantRaw !== '-' ? algebraicToSquare(enPassantRaw) : null;
  const halfmoveClock = Number(halfmoveRaw ?? 0) || 0;
  const fullmoveNumber = Number(fullmoveRaw ?? 1) || 1;

  const state: GameState = {
    board,
    pieces,
    activeColor,
    castlingRights,
    enPassantTarget: enPassantTarget ? { file: enPassantTarget.file, rank: enPassantTarget.rank } : null,
    halfmoveClock,
    fullmoveNumber,
    lastMove: null,
    positionCounts: new Map()
  };

  state.positionCounts?.set(getPositionKey(state), 1);
  return state;
}

function fenCharToPiece(char: string): { type: PieceType; color: Color } | null {
  const lower = char.toLowerCase();
  const type =
    lower === 'p'
      ? 'pawn'
      : lower === 'n'
      ? 'knight'
      : lower === 'b'
      ? 'bishop'
      : lower === 'r'
      ? 'rook'
      : lower === 'q'
      ? 'queen'
      : lower === 'k'
      ? 'king'
      : null;
  if (!type) {
    return null;
  }
  const color: Color = char === lower ? 'b' : 'w';
  return { type, color };
}

function formatRunId(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, '0');
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-` +
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

function resolveCommitSha(): string {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
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

function parseArgs(argv: string[]): {
  stockfishPath: string | null;
  batchSize?: number;
  movetimeMs?: number;
  stockfishMovetime?: number;
  stockfishLadder?: number[];
  mode?: EngineMode;
  threads?: number;
  hashMb?: number;
  maxPlies?: number;
  seriesLabel?: string;
  reset?: boolean;
  swap?: boolean;
  fenSuite?: boolean;
  baseSeed?: number;
  outDir?: string;
  runId?: string;
} {
  const result: {
    stockfishPath: string | null;
    batchSize?: number;
    movetimeMs?: number;
    stockfishMovetime?: number;
    mode?: EngineMode;
    threads?: number;
    hashMb?: number;
    maxPlies?: number;
    seriesLabel?: string;
    reset?: boolean;
    swap?: boolean;
    fenSuite?: boolean;
    baseSeed?: number;
    outDir?: string;
    runId?: string;
  } = { stockfishPath: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--stockfish') {
      result.stockfishPath = argv[i + 1] ?? null;
      i += 1;
    } else if (arg === '--batch' || arg === '--games') {
      result.batchSize = Number(argv[i + 1]);
      i += 1;
    } else if (arg === '--movetime') {
      result.movetimeMs = Number(argv[i + 1]);
      i += 1;
    } else if (arg === '--stockfishMovetime' || arg === '--stockfish-movetime') {
      result.stockfishMovetime = Number(argv[i + 1]);
      i += 1;
    } else if (arg === '--sf-ladder' || arg === '--stockfish-ladder') {
      const raw = argv[i + 1] ?? DEFAULT_STOCKFISH_LADDER;
      result.stockfishLadder = raw
        .split(',')
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isFinite(value) && value > 0);
      i += 1;
    } else if (arg === '--mode') {
      const mode = argv[i + 1];
      if (mode === 'hard' || mode === 'max') {
        result.mode = mode;
      }
      i += 1;
    } else if (arg === '--threads') {
      result.threads = Number(argv[i + 1]);
      i += 1;
    } else if (arg === '--hash') {
      result.hashMb = Number(argv[i + 1]);
      i += 1;
    } else if (arg === '--max-plies') {
      result.maxPlies = Number(argv[i + 1]);
      i += 1;
    } else if (arg === '--reset') {
      result.reset = true;
    } else if (arg === '--swap') {
      result.swap = true;
    } else if (arg === '--no-swap') {
      result.swap = false;
    } else if (arg === '--fenSuite') {
      result.fenSuite = true;
    } else if (arg === '--no-fenSuite') {
      result.fenSuite = false;
    } else if (arg === '--seed') {
      result.baseSeed = Number(argv[i + 1]);
      i += 1;
    } else if (arg === '--outDir') {
      result.outDir = argv[i + 1];
      i += 1;
    } else if (arg === '--runId') {
      result.runId = argv[i + 1];
      i += 1;
    } else if (arg === '--series-label' || arg === '--label') {
      result.seriesLabel = argv[i + 1] ?? '';
      i += 1;
    }
  }
  return result;
}

async function loadRunState(
  config: RunConfig,
  reset?: boolean,
  seriesLabel?: string
): Promise<RunState> {
  if (!reset) {
    try {
      const raw = await fs.readFile(STATE_PATH, 'utf8');
      if (!raw.trim()) {
        throw new Error('Empty run state.');
      }
      const parsed = JSON.parse(raw) as RunState;
      if (parsed.config && parsed.config.stockfishPath === config.stockfishPath) {
        if (
          parsed.config.movetimeMs === config.movetimeMs &&
          JSON.stringify(parsed.config.stockfishMovetimes) ===
            JSON.stringify(config.stockfishMovetimes) &&
          parsed.config.mode === config.mode &&
          parsed.config.threads === config.threads &&
          parsed.config.hashMb === config.hashMb &&
          parsed.config.maxPlies === config.maxPlies &&
          parsed.config.swap === config.swap &&
          parsed.config.fenSuite === config.fenSuite &&
          parsed.config.baseSeed === config.baseSeed
        ) {
          parsed.config.outDir = config.outDir;
          return parsed;
        }
      }
      throw new Error('Config mismatch. Run with --reset to start a new series.');
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('Config mismatch')) {
        throw error;
      }
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        if (error instanceof SyntaxError || message === 'Empty run state.') {
          console.warn('[bench] run state invalid; starting new series.');
        } else {
          throw error;
        }
      }
    }
  }

  const now = new Date().toISOString();
  const freshState: RunState = {
    startedAt: now,
    updatedAt: now,
    seriesLabel: seriesLabel?.trim() || DEFAULT_SERIES_LABEL,
    config: {
      stockfishPath: config.stockfishPath,
      movetimeMs: config.movetimeMs,
      stockfishMovetimes: config.stockfishMovetimes,
      mode: config.mode,
      threads: config.threads,
      hashMb: config.hashMb,
      ponder: config.ponder,
      maxPlies: config.maxPlies,
      swap: config.swap,
      fenSuite: config.fenSuite,
      baseSeed: config.baseSeed,
      outDir: config.outDir
    },
    totalGames: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    nextOpening: 0,
    stockfishRungIndex: 0,
    batches: []
  };
  await saveRunState(freshState);
  return freshState;
}

async function saveRunState(state: RunState): Promise<void> {
  const payload = JSON.stringify(state, null, 2);
  const tmpPath = `${STATE_PATH}.tmp`;
  await fs.writeFile(tmpPath, payload, 'utf8');
  await fs.rm(STATE_PATH, { force: true });
  await fs.rename(tmpPath, STATE_PATH);
}

function buildBatchResult(args: {
  batchIndex: number;
  startedAt: string;
  finishedAt: string;
  wins: number;
  draws: number;
  losses: number;
  totalPlies: number;
  endReasons: Record<string, number>;
  engineTargetMs: number;
  stockfishTargetMs: number;
  engineTimeouts: number;
  stockfishTimeouts: number;
  engineOverheadCount: number;
  engineStopLatencies: number[];
  engineTimes: number[];
  stockfishTimes: number[];
  engineMoveCount: number;
  engineTimedOutMoves: number;
  engineNonTimeoutTotalMs: number;
  engineTimeoutTotalMs: number;
  engineNonTimeoutMaxMs: number;
  engineTimeoutMaxMs: number;
}): BatchResult {
  const games = args.wins + args.draws + args.losses;
  const score = games > 0 ? (args.wins + args.draws * 0.5) / games : 0;
  const { elo, low, high } = scoreToElo(score, games);
  return {
    batchIndex: args.batchIndex,
    startedAt: args.startedAt,
    finishedAt: args.finishedAt,
    games,
    wins: args.wins,
    draws: args.draws,
    losses: args.losses,
    score,
    eloDelta: elo,
    eloLow: low,
    eloHigh: high,
    avgPlies: games > 0 ? args.totalPlies / games : 0,
    endReasons: args.endReasons,
    engineTargetMs: args.engineTargetMs,
    stockfishTargetMs: args.stockfishTargetMs,
    engineTimeouts: args.engineTimeouts,
    stockfishTimeouts: args.stockfishTimeouts,
    engineOverheadCount: args.engineOverheadCount,
    engineStopLatencyAvg: average(args.engineStopLatencies),
    avgEngineMs: average(args.engineTimes),
    avgStockfishMs: average(args.stockfishTimes),
    engineMoveCount: args.engineMoveCount,
    engineTimedOutMoves: args.engineTimedOutMoves,
    engineNonTimeoutTotalMs: args.engineNonTimeoutTotalMs,
    engineTimeoutTotalMs: args.engineTimeoutTotalMs,
    engineNonTimeoutMaxMs: args.engineNonTimeoutMaxMs,
    engineTimeoutMaxMs: args.engineTimeoutMaxMs
  };
}

function scoreToElo(score: number, games: number): { elo: number | null; low: number | null; high: number | null } {
  if (games === 0) {
    return { elo: null, low: null, high: null };
  }
  if (score <= 0 || score >= 1) {
    return { elo: null, low: null, high: null };
  }
  const clamped = Math.min(0.9999, Math.max(0.0001, score));
  const elo = 400 * Math.log10(clamped / (1 - clamped));
  const { low, high } = wilsonInterval(score, games, 1.96);
  const lowElo = 400 * Math.log10(Math.min(0.9999, Math.max(0.0001, low)) / (1 - low));
  const highElo = 400 * Math.log10(Math.min(0.9999, Math.max(0.0001, high)) / (1 - high));
  return { elo, low: lowElo, high: highElo };
}

function wilsonInterval(p: number, n: number, z: number): { low: number; high: number } {
  if (n === 0) {
    return { low: 0, high: 1 };
  }
  const denom = 1 + (z * z) / n;
  const center = p + (z * z) / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n);
  return {
    low: Math.max(0, (center - margin) / denom),
    high: Math.min(1, (center + margin) / denom)
  };
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatEtTimestamp(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) {
    return 'unknown ET';
  }
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')} ET`;
}

function formatElo(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return 'n/a';
  }
  const rounded = Math.round(value);
  return `${rounded >= 0 ? '+' : ''}${rounded}`;
}

function resolveRunId(outDir: string): string | null {
  const base = path.basename(outDir);
  if (base.startsWith('run-')) {
    return base.slice(4);
  }
  return null;
}

function resolveRoadmapPhase(runId: string | null): string {
  if (!runId) {
    return 'Unknown';
  }
  const id = runId.toLowerCase();
  if (id.startsWith('phase6-')) {
    return 'Phase 6';
  }
  if (id.startsWith('phase5_q1-')) {
    return 'Phase 5.Q1';
  }
  if (id.startsWith('phase5_q2-')) {
    return 'Phase 5.Q2';
  }
  if (id.startsWith('phase5_q3_2-')) {
    return 'Phase 5.Q3.2';
  }
  if (id.startsWith('phase5_q3-')) {
    return 'Phase 5.Q3';
  }
  if (id.startsWith('phase5_q4-')) {
    return 'Phase 5.Q4';
  }
  const match = id.match(/^phase(\d+)_(\d+)/);
  if (match) {
    return `Phase ${match[1]}.${match[2]}`;
  }
  return 'Unknown';
}

async function updateReport(
  state: RunState,
  config: RunConfig,
  meta: { commitSha: string; commandLine: string }
): Promise<void> {
  const text = await fs.readFile(REPORT_PATH, 'utf8');
  const start = '<!-- REPORT:START -->';
  const end = '<!-- REPORT:END -->';
  const startIndex = text.indexOf(start);
  const endIndex = text.indexOf(end);
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error('Report markers not found in ScorpionChessEngineVsStockfishReport.md');
  }

  const reportBody = buildReportBody(state, config, meta);
  const existingBody = text.slice(startIndex + start.length, endIndex);
  const updated =
    text.slice(0, startIndex + start.length) +
    `\n${reportBody}\n` +
    existingBody +
    text.slice(endIndex);
  await fs.writeFile(REPORT_PATH, updated, 'utf8');
}

async function writeRunSummary(
  state: RunState,
  config: RunConfig,
  meta: { commitSha: string; commandLine: string }
): Promise<void> {
  const payload = {
    startedAt: state.startedAt,
    updatedAt: state.updatedAt,
    seriesLabel: state.seriesLabel ?? 'unspecified',
    config,
    commitSha: meta.commitSha,
    commandLine: meta.commandLine,
    totals: {
      games: state.totalGames,
      wins: state.wins,
      draws: state.draws,
      losses: state.losses
    },
    batches: state.batches
  };
  await fs.writeFile(path.join(config.outDir, 'summary.json'), JSON.stringify(payload, null, 2), 'utf8');
}

function buildReportBody(
  state: RunState,
  config: RunConfig,
  meta: { commitSha: string; commandLine: string }
): string {
  const score = state.totalGames
    ? (state.wins + state.draws * 0.5) / state.totalGames
    : 0;
  const { elo, low, high } = scoreToElo(score, state.totalGames);
  const currentRung =
    config.stockfishMovetimes[state.stockfishRungIndex] ?? config.stockfishMovetimes[0];
  const lastBatch = state.batches[state.batches.length - 1];
  const lastRung = lastBatch ? lastBatch.stockfishTargetMs : currentRung;
  const eloLine =
    elo === null
      ? 'Elo delta: Outside estimation range (shutout).'
      : `Elo delta: ${formatElo(elo)} (95% CI ${formatElo(low)} to ${formatElo(high)})`;
  const summary = summarizeEndReasons(state.batches);
  const timingSummary = summarizeEngineTimings(state.batches);
  const roadmapPhase = resolveRoadmapPhase(resolveRunId(config.outDir));
  const lines = [
    `Last updated: ${state.updatedAt} (UTC) | ${formatEtTimestamp(state.updatedAt)}`,
    `Series: ${state.seriesLabel ?? 'unspecified'}`,
    `Roadmap phase: ${roadmapPhase}`,
    '',
    `Config: Scorpion ${config.mode} @ ${config.movetimeMs}ms | Stockfish movetime ${lastRung}ms | swap=${config.swap} | fenSuite=${config.fenSuite} | seed=${config.baseSeed}`,
    `Commit: ${meta.commitSha}`,
    `Command: ${meta.commandLine}`,
    `Stockfish: ${config.stockfishPath}`,
    `Settings: Threads=${config.threads}, Hash=${config.hashMb}MB, Ponder=${config.ponder ? 'true' : 'false'}`,
    `Movetime targets: Scorpion=${config.movetimeMs}ms, Stockfish=${lastRung}ms`,
    `Timeout tolerance: +${TIMEOUT_TOLERANCE_BUMP_MS}ms (bench-only stop-latency/jitter slack)`,
    `Next ladder rung: paused (Stockfish=${currentRung}ms)`,
    `Output: ${config.outDir}`,
    '',
    `Cumulative: ${state.wins}-${state.draws}-${state.losses} (${state.totalGames} games)`,
    `Score: ${score.toFixed(3)}`,
    eloLine,
    `Avg plies per game: ${summary.avgPlies.toFixed(1)}`,
    `End reasons: mate=${summary.mate}, stalemate=${summary.stalemate}, repetition=${summary.repetition}, ` +
      `50-move=${summary.fiftyMove}, other=${summary.other}`,
    `Timed out moves: ${timingSummary.timedOutMoves}/${timingSummary.moveCount}`,
    `Avg ms (non-timeout): ${timingSummary.avgNonTimeoutMs.toFixed(1)}, ` +
      `Avg ms (timeout): ${timingSummary.avgTimeoutMs.toFixed(1)}`,
    `Max ms (non-timeout): ${timingSummary.maxNonTimeoutMs.toFixed(1)}, ` +
      `Max ms (timeout): ${timingSummary.maxTimeoutMs.toFixed(1)}`,
    ''
  ];

  if (summary.avgPlies < REPORT_WARNING_MIN_PLIES) {
    lines.push('WARNING: Invalid benchmark: games terminated too early.');
    lines.push('');
  }

  if (state.batches.length > 0) {
    lines.push('Batch history:');
    lines.push(
      'Batch | Games | W | D | L | Score | Elo | Scorpion ms (target/avg) | Stockfish ms (target/avg) | Timeouts | Timed-out moves | Avg ms (ok/timeout) | Max ms (ok/timeout) | Stop Latency (avg ms) | Overhead'
    );
    lines.push('--- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---');
    for (const batch of state.batches) {
      const engineMoveCount = batch.engineMoveCount ?? 0;
      const engineTimedOutMoves = batch.engineTimedOutMoves ?? 0;
      const engineNonTimeoutTotalMs = batch.engineNonTimeoutTotalMs ?? 0;
      const engineTimeoutTotalMs = batch.engineTimeoutTotalMs ?? 0;
      const engineNonTimeoutMaxMs = batch.engineNonTimeoutMaxMs ?? 0;
      const engineTimeoutMaxMs = batch.engineTimeoutMaxMs ?? 0;
      const nonTimeoutMoves = Math.max(0, engineMoveCount - engineTimedOutMoves);
      const avgNonTimeoutMs =
        nonTimeoutMoves > 0 ? engineNonTimeoutTotalMs / nonTimeoutMoves : 0;
      const avgTimeoutMs =
        engineTimedOutMoves > 0 ? engineTimeoutTotalMs / engineTimedOutMoves : 0;
      lines.push(
        `${batch.batchIndex} | ${batch.games} | ${batch.wins} | ${batch.draws} | ${batch.losses} | ` +
          `${batch.score.toFixed(3)} | ${batch.eloDelta === null ? 'n/a' : formatElo(batch.eloDelta)} | ` +
          `${batch.engineTargetMs}/${batch.avgEngineMs.toFixed(1)} | ` +
          `${batch.stockfishTargetMs}/${batch.avgStockfishMs.toFixed(1)} | ` +
          `B:${batch.engineTimeouts} SF:${batch.stockfishTimeouts} | ` +
          `${engineTimedOutMoves}/${engineMoveCount} | ` +
          `${avgNonTimeoutMs.toFixed(1)}/${avgTimeoutMs.toFixed(1)} | ` +
          `${engineNonTimeoutMaxMs.toFixed(1)}/${engineTimeoutMaxMs.toFixed(1)} | ` +
          `${batch.engineStopLatencyAvg.toFixed(1)} | ${batch.engineOverheadCount}`
      );
    }
  }

  return lines.join('\n');
}

function summarizeEndReasons(batches: BatchResult[]): {
  mate: number;
  stalemate: number;
  repetition: number;
  fiftyMove: number;
  other: number;
  avgPlies: number;
} {
  const totals = {
    mate: 0,
    stalemate: 0,
    repetition: 0,
    fiftyMove: 0,
    other: 0,
    games: 0,
    plies: 0
  };
  for (const batch of batches) {
    totals.games += batch.games;
    if (Number.isFinite(batch.avgPlies)) {
      totals.plies += batch.avgPlies * batch.games;
    }
    if (batch.endReasons) {
      totals.mate += batch.endReasons.mate ?? 0;
      totals.stalemate += batch.endReasons.stalemate ?? 0;
      totals.repetition += batch.endReasons.repetition ?? 0;
      totals.fiftyMove += batch.endReasons.fiftyMove ?? 0;
      totals.other += batch.endReasons.other ?? 0;
    } else {
      totals.other += batch.games;
    }
  }
  return {
    mate: totals.mate,
    stalemate: totals.stalemate,
    repetition: totals.repetition,
    fiftyMove: totals.fiftyMove,
    other: totals.other,
    avgPlies: totals.games > 0 ? totals.plies / totals.games : 0
  };
}

function summarizeEngineTimings(batches: BatchResult[]): {
  moveCount: number;
  timedOutMoves: number;
  avgNonTimeoutMs: number;
  avgTimeoutMs: number;
  maxNonTimeoutMs: number;
  maxTimeoutMs: number;
} {
  let moveCount = 0;
  let timedOutMoves = 0;
  let nonTimeoutTotalMs = 0;
  let timeoutTotalMs = 0;
  let maxNonTimeoutMs = 0;
  let maxTimeoutMs = 0;

  for (const batch of batches) {
    moveCount += batch.engineMoveCount ?? 0;
    timedOutMoves += batch.engineTimedOutMoves ?? 0;
    nonTimeoutTotalMs += batch.engineNonTimeoutTotalMs ?? 0;
    timeoutTotalMs += batch.engineTimeoutTotalMs ?? 0;
    maxNonTimeoutMs = Math.max(maxNonTimeoutMs, batch.engineNonTimeoutMaxMs ?? 0);
    maxTimeoutMs = Math.max(maxTimeoutMs, batch.engineTimeoutMaxMs ?? 0);
  }

  const nonTimeoutMoves = Math.max(0, moveCount - timedOutMoves);
  return {
    moveCount,
    timedOutMoves,
    avgNonTimeoutMs: nonTimeoutMoves > 0 ? nonTimeoutTotalMs / nonTimeoutMoves : 0,
    avgTimeoutMs: timedOutMoves > 0 ? timeoutTotalMs / timedOutMoves : 0,
    maxNonTimeoutMs,
    maxTimeoutMs
  };
}

function createEngineWorker(): Worker {
  return new Worker(new URL('./engineWorker.cjs', import.meta.url));
}

async function runEngineWithTimeout(
  worker: Worker,
  state: GameState,
  options: {
    color: Color;
    difficulty: EngineMode;
    maxTimeMs?: number;
    maxDepth?: number;
    seed: number;
    instrumentation?: boolean;
  },
  targetMs: number,
  graceMs: number,
  onStopLatency: (latency: number | null) => void,
  onTimeout: () => void
): Promise<{
  move: Move | null;
  error?: string;
  worker: Worker;
  timedOut: boolean;
  meta?: { [key: string]: unknown };
}> {
  let activeWorker = worker;
  const requestId = Math.floor(Math.random() * 1e9);
  let stopSentAt: number | null = null;
  let timedOut = false;
  const debug = typeof process !== 'undefined' && process.env?.BENCH_DEBUG === '1';

  const result = await new Promise<{
    move: Move | null;
    error?: string;
    worker: Worker;
    timedOut: boolean;
    meta?: { [key: string]: unknown };
  }>(
    (resolve) => {
      const attachedWorker = activeWorker;
      const stopTimer = setTimeout(() => {
        stopSentAt = performance.now();
        attachedWorker.postMessage({ kind: 'stop', id: requestId });
      }, targetMs);

      const timeout = setTimeout(() => {
        onTimeout();
        timedOut = true;
        cleanup();
        attachedWorker.terminate();
        activeWorker = createEngineWorker();
        onStopLatency(null);
        resolve({ move: fallbackMove(state), worker: activeWorker, timedOut });
      }, targetMs + graceMs);

      const cleanup = () => {
        clearTimeout(stopTimer);
        clearTimeout(timeout);
        attachedWorker.off('message', onMessage);
        attachedWorker.off('error', onError);
      };

      const onMessage = (response: {
        id: number;
        move: Move | null;
        error?: string;
        meta?: { [key: string]: unknown };
      }) => {
        if (response.id !== requestId) {
          return;
        }
        cleanup();
        if (stopSentAt !== null) {
          onStopLatency(Math.max(0, performance.now() - stopSentAt));
        } else {
          onStopLatency(null);
        }
        if (debug && response.meta) {
          console.log('[BENCH_DEBUG] engine meta', response.meta);
        }
        resolve({
          move: response.move,
          error: response.error,
          worker: activeWorker,
          timedOut,
          meta: response.meta
        });
      };

      const onError = (error: unknown) => {
        cleanup();
        attachedWorker.terminate();
        activeWorker = createEngineWorker();
        onStopLatency(null);
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
