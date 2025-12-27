import { promises as fs } from 'node:fs';
import path from 'node:path';
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

type GameLog = {
  gameId: number;
  mode: EngineMode;
  engineColor: Color;
  engineLabel: string;
  opening: string[];
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
  result?: string;
  outcome?: 'win' | 'loss' | 'draw';
};

type RunState = {
  startedAt: string;
  updatedAt: string;
  config: {
    stockfishPath: string;
    movetimeMs: number;
    stockfishMovetimes: number[];
    mode: EngineMode;
    threads: number;
    hashMb: number;
    ponder: boolean;
    maxPlies: number;
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

const RESULTS_DIR = path.resolve('scripts/bench/quick-results');
const STATE_PATH = path.resolve('scripts/bench/quick-run-state.json');
const REPORT_PATH = path.resolve('docs/BrainITVsStockfishReport.md');

const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_MOVETIME_MS = 100;
const DEFAULT_MODE: EngineMode = 'max';
const DEFAULT_THREADS = 1;
const DEFAULT_HASH_MB = 64;
const DEFAULT_MAX_PLIES = 200;
const DEFAULT_STOCKFISH_LADDER = '100,50,20,10,5';
const ENGINE_TIMEOUT_GRACE_MS = 40;
const STOCKFISH_TIMEOUT_SLACK_MS = 20;
const MIN_PLIES_FOR_DRAW = 2;
const REPORT_WARNING_MIN_PLIES = 10;

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
  if (!args.stockfishPath) {
    console.error('Missing --stockfish path.');
    process.exitCode = 1;
    return;
  }

  const config: RunConfig = {
    stockfishPath: args.stockfishPath,
    batchSize: args.batchSize ?? DEFAULT_BATCH_SIZE,
    movetimeMs: args.movetimeMs ?? DEFAULT_MOVETIME_MS,
    stockfishMovetimes: args.stockfishLadder ?? [args.movetimeMs ?? DEFAULT_MOVETIME_MS],
    mode: args.mode ?? DEFAULT_MODE,
    threads: args.threads ?? DEFAULT_THREADS,
    hashMb: args.hashMb ?? DEFAULT_HASH_MB,
    ponder: false,
    maxPlies: args.maxPlies ?? DEFAULT_MAX_PLIES
  };

  const state = await loadRunState(config, args.reset);
  await fs.mkdir(RESULTS_DIR, { recursive: true });

  if (config.batchSize <= 0) {
    await updateReport(state, config);
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

  for (let gameIndex = 0; gameIndex < config.batchSize; gameIndex += 1) {
    const opening = OPENINGS[state.nextOpening % OPENINGS.length];
    state.nextOpening += 1;
    const engineColor: Color = state.totalGames % 2 === 0 ? 'w' : 'b';
    const seed = 1000 + state.totalGames;
    const gameId = state.totalGames + 1;

    const engineLabel = config.mode === 'max' ? 'BrainIT (Max Thinking)' : 'BrainIT (Hard)';
    let result: Awaited<ReturnType<typeof runSingleGame>>;
    try {
      result = await runSingleGame({
        gameId,
        opening,
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
        onStockfishTimeout: () => {
          stockfishTimeouts += 1;
        }
      });
    } catch (error) {
      await writeGameError({
        gameId,
        engineColor,
        engineLabel,
        mode: config.mode,
        opening,
        error
      });
      throw error;
    }
    batchPlies += result.plies;
    endReasons[result.endReason] = (endReasons[result.endReason] ?? 0) + 1;

    state.totalGames += 1;
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
      path.join(RESULTS_DIR, `game-${state.totalGames.toString().padStart(4, '0')}.pgn`),
      result.pgn,
      'utf8'
    );
    await writeGameLog(result.log);
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
    stockfishTimes
  });

  state.batches.push(batchStats);
  // Ladder progression is paused until timeout rates and termination validity are verified.
  state.updatedAt = batchFinished;
  await saveRunState(state);
  await updateReport(state, config);

  console.log(
    `Batch complete: ${batchStats.wins}-${batchStats.draws}-${batchStats.losses} ` +
      `(score ${batchStats.score.toFixed(3)}, Elo ${formatElo(batchStats.eloDelta)})`
  );
  console.log('Run the script again to play the next batch.');
}

async function runSingleGame(options: {
  gameId: number;
  opening: string[];
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
  onStockfishTimeout: () => void;
}): Promise<{
  result: string;
  outcome: 'win' | 'loss' | 'draw';
  pgn: string;
  plies: number;
  endReason: string;
  log: GameLog;
}> {
  const state = createInitialState();
  const pgnMoves: PgnMove[] = [];
  let lastMoveUci: string | null = null;
  let lastMoveSan: string | null = null;
  const openingResult = applyOpening(state, options.opening, pgnMoves);
  let plies = openingResult.plies;
  lastMoveUci = openingResult.lastMoveUci;
  lastMoveSan = openingResult.lastMoveSan;
  const rng = createSeededRng(options.seed);

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
          plies,
          finalFen: stateToFen(state),
          lastMoveUci,
          lastMoveSan,
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
          plies,
          finalFen: stateToFen(state),
          lastMoveUci,
          lastMoveSan,
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
            options.onEngineTimeout
          )
        : await pickStockfishMove(
            state,
            options,
            options.stockfishTimes,
            options.onStockfishTimeout
          );

    if (!move.move) {
      throw new BenchmarkError('Move selection failed.', {
        gameId: options.gameId,
        mode: options.mode,
        engineColor: options.engineColor,
        engineLabel: options.engineLabel,
        opening: options.opening,
        plies,
        finalFen: stateToFen(state),
        lastMoveUci,
        lastMoveSan,
        termination: {
          trigger: move.trigger ?? 'missing_bestmove',
          message: move.message
        }
      });
    }

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
      plies,
      finalFen: stateToFen(state),
      lastMoveUci,
      lastMoveSan,
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
  onTimeout: () => void
): Promise<{ move: Move | null; trigger?: TerminationTrigger; message?: string }> {
  const start = performance.now();
  const seed = Math.floor(rng() * 1000000000);
  const result = await runEngineWithTimeout(
    state,
    {
      color: state.activeColor,
      difficulty: options.mode,
      maxTimeMs: options.mode === 'max' ? options.movetimeMs : undefined,
      maxDepth: options.mode === 'max' ? MAX_THINKING_DEPTH_CAP : undefined,
      seed
    },
    options.movetimeMs,
    ENGINE_TIMEOUT_GRACE_MS,
    onStopLatency,
    onTimeout
  );
  const elapsed = performance.now() - start;
  timings.push(elapsed);
  if (result.error) {
    return { move: null, trigger: 'engine_worker_error', message: result.error };
  }
  if (!result.move) {
    return { move: null, trigger: 'missing_bestmove', message: 'Engine returned no move.' };
  }
  return { move: result.move };
}

async function pickStockfishMove(
  state: GameState,
  options: { stockfishMovetimeMs: number; stockfish: StockfishClient },
  timings: number[],
  onTimeout: () => void
): Promise<{ move: Move | null; trigger?: TerminationTrigger; message?: string }> {
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
      message: timedOut ? 'Stockfish timed out before bestmove.' : 'Stockfish returned no bestmove.'
    };
  }
  const move = uciToMove(state, best);
  if (!move) {
    return {
      move: null,
      trigger: 'invalid_bestmove',
      message: `Stockfish bestmove not legal: ${best}`
    };
  }
  return { move };
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
    event: 'BrainIT vs Stockfish (Quick)',
    site: 'Local',
    date: new Date()
  });
  return { result, outcome, pgn };
}

async function writeGameLog(log: GameLog): Promise<void> {
  const filename = `game-${log.gameId.toString().padStart(4, '0')}-meta.json`;
  await fs.writeFile(path.join(RESULTS_DIR, filename), JSON.stringify(log, null, 2), 'utf8');
}

async function writeGameError(args: {
  gameId: number;
  engineColor: Color;
  engineLabel: string;
  mode: EngineMode;
  opening: string[];
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
          plies: 0,
          finalFen: 'unknown',
          lastMoveUci: null,
          lastMoveSan: null,
          termination: {
            trigger: 'missing_bestmove',
            message: args.error instanceof Error ? args.error.message : String(args.error)
          }
        } satisfies GameLog);
  const payload = {
    error: args.error instanceof Error ? args.error.message : String(args.error),
    details
  };
  await fs.writeFile(path.join(RESULTS_DIR, filename), JSON.stringify(payload, null, 2), 'utf8');
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
  stockfishLadder?: number[];
  mode?: EngineMode;
  threads?: number;
  hashMb?: number;
  maxPlies?: number;
  reset?: boolean;
} {
  const result: {
    stockfishPath: string | null;
    batchSize?: number;
    movetimeMs?: number;
    mode?: EngineMode;
    threads?: number;
    hashMb?: number;
    maxPlies?: number;
    reset?: boolean;
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
    }
  }
  return result;
}

async function loadRunState(config: RunConfig, reset?: boolean): Promise<RunState> {
  if (!reset) {
    try {
      const raw = await fs.readFile(STATE_PATH, 'utf8');
      const parsed = JSON.parse(raw) as RunState;
      if (parsed.config && parsed.config.stockfishPath === config.stockfishPath) {
        if (
          parsed.config.movetimeMs === config.movetimeMs &&
          JSON.stringify(parsed.config.stockfishMovetimes) ===
            JSON.stringify(config.stockfishMovetimes) &&
          parsed.config.mode === config.mode &&
          parsed.config.threads === config.threads &&
          parsed.config.hashMb === config.hashMb &&
          parsed.config.maxPlies === config.maxPlies
        ) {
          return parsed;
        }
      }
      throw new Error('Config mismatch. Run with --reset to start a new series.');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  const now = new Date().toISOString();
  return {
    startedAt: now,
    updatedAt: now,
    config: {
      stockfishPath: config.stockfishPath,
      movetimeMs: config.movetimeMs,
      stockfishMovetimes: config.stockfishMovetimes,
      mode: config.mode,
      threads: config.threads,
      hashMb: config.hashMb,
      ponder: config.ponder,
      maxPlies: config.maxPlies
    },
    totalGames: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    nextOpening: 0,
    stockfishRungIndex: 0,
    batches: []
  };
}

async function saveRunState(state: RunState): Promise<void> {
  await fs.writeFile(STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
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
    avgStockfishMs: average(args.stockfishTimes)
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

function formatElo(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return 'n/a';
  }
  const rounded = Math.round(value);
  return `${rounded >= 0 ? '+' : ''}${rounded}`;
}

async function updateReport(state: RunState, config: RunConfig): Promise<void> {
  const text = await fs.readFile(REPORT_PATH, 'utf8');
  const start = '<!-- REPORT:START -->';
  const end = '<!-- REPORT:END -->';
  const startIndex = text.indexOf(start);
  const endIndex = text.indexOf(end);
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error('Report markers not found in BrainITVsStockfishReport.md');
  }

  const reportBody = buildReportBody(state, config);
  const updated =
    text.slice(0, startIndex + start.length) +
    `\n${reportBody}\n` +
    text.slice(endIndex);
  await fs.writeFile(REPORT_PATH, updated, 'utf8');
}

function buildReportBody(state: RunState, config: RunConfig): string {
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
  const lines = [
    `Last updated: ${state.updatedAt}`,
    '',
    `Config: BrainIT ${config.mode} @ ${config.movetimeMs}ms | Stockfish movetime ${lastRung}ms`,
    `Stockfish: ${config.stockfishPath}`,
    `Settings: Threads=${config.threads}, Hash=${config.hashMb}MB, Ponder=${config.ponder ? 'true' : 'false'}`,
    `Movetime targets: BrainIT=${config.movetimeMs}ms, Stockfish=${lastRung}ms`,
    `Next ladder rung: paused (Stockfish=${currentRung}ms)`,
    '',
    `Cumulative: ${state.wins}-${state.draws}-${state.losses} (${state.totalGames} games)`,
    `Score: ${score.toFixed(3)}`,
    eloLine,
    `Avg plies per game: ${summary.avgPlies.toFixed(1)}`,
    `End reasons: mate=${summary.mate}, stalemate=${summary.stalemate}, repetition=${summary.repetition}, ` +
      `50-move=${summary.fiftyMove}, other=${summary.other}`,
    ''
  ];

  if (summary.avgPlies < REPORT_WARNING_MIN_PLIES) {
    lines.push('WARNING: Invalid benchmark: games terminated too early.');
    lines.push('');
  }

  if (state.batches.length > 0) {
    lines.push('Batch history:');
    lines.push(
      'Batch | Games | W | D | L | Score | Elo | BrainIT ms (target/avg) | Stockfish ms (target/avg) | Timeouts | Stop Latency (avg ms) | Overhead'
    );
    lines.push('--- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---');
    for (const batch of state.batches) {
      lines.push(
        `${batch.batchIndex} | ${batch.games} | ${batch.wins} | ${batch.draws} | ${batch.losses} | ` +
          `${batch.score.toFixed(3)} | ${batch.eloDelta === null ? 'n/a' : formatElo(batch.eloDelta)} | ` +
          `${batch.engineTargetMs}/${batch.avgEngineMs.toFixed(1)} | ` +
          `${batch.stockfishTargetMs}/${batch.avgStockfishMs.toFixed(1)} | ` +
          `B:${batch.engineTimeouts} SF:${batch.stockfishTimeouts} | ` +
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

async function runEngineWithTimeout(
  state: GameState,
  options: {
    color: Color;
    difficulty: EngineMode;
    maxTimeMs?: number;
    maxDepth?: number;
    seed: number;
  },
  targetMs: number,
  graceMs: number,
  onStopLatency: (latency: number | null) => void,
  onTimeout: () => void
): Promise<{ move: Move | null; error?: string }> {
  const workerPath = new URL('./engineWorker.cjs', import.meta.url);
  const worker = new Worker(workerPath);
  const requestId = Math.floor(Math.random() * 1e9);
  let stopSentAt: number | null = null;

  const result = await new Promise<{ move: Move | null; error?: string }>((resolve) => {
    const stopTimer = setTimeout(() => {
      stopSentAt = performance.now();
      worker.postMessage({ kind: 'stop', id: requestId });
    }, targetMs);

    const timeout = setTimeout(() => {
      onTimeout();
      worker.terminate();
      resolve({ move: fallbackMove(state) });
    }, targetMs + graceMs);

    worker.once('message', (response: { id: number; move: Move | null; error?: string }) => {
      if (response.id !== requestId) {
        return;
      }
      clearTimeout(stopTimer);
      clearTimeout(timeout);
      worker.terminate();
      if (stopSentAt !== null) {
        onStopLatency(Math.max(0, performance.now() - stopSentAt));
      } else {
        onStopLatency(null);
      }
      resolve({ move: response.move, error: response.error });
    });

    worker.once('error', (error) => {
      clearTimeout(stopTimer);
      clearTimeout(timeout);
      worker.terminate();
      onStopLatency(null);
      resolve({ move: null, error: error instanceof Error ? error.message : String(error) });
    });

    worker.postMessage({
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
