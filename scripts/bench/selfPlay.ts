import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
  getPieceAt,
  getPositionKey
} from '../../src/rules';
import { buildSan, buildSanLine, PgnMove } from '../../src/pgn/pgn';
import { MAX_THINKING_DEPTH_CAP } from '../../src/ai/ai';

type EngineSide = 'hard' | 'max';

type RootDiagnostics = {
  rootTopMoves: {
    move: Move;
    score: number;
    baseScore: number;
    isRepeat: boolean;
    repeatCount: number;
  }[];
  chosenMoveReason: string;
  bestRepeatKind: string;
  bestIsRepeat: boolean;
};

type MoveDiagnosticsEntry = {
  ply: number;
  color: Color;
  side: EngineSide;
  timedOut: boolean;
  chosenMoveReason: string;
  bestRepeatKind: string;
  bestIsRepeat: boolean;
  rootTopMoves: {
    uci: string;
    score: number;
    baseScore: number;
    isRepeat: boolean;
    repeatCount: number;
  }[];
};

type RunConfig = {
  batchSize: number;
  hardMs: number;
  maxMs: number;
  maxPlies: number;
  swap: boolean;
  fenSuite: boolean;
  outDir?: string;
  baseSeed: number;
};

type SideTimings = {
  avgMs: number;
  maxMs: number;
  timeouts: number;
  moveCount: number;
};

type TimingTotals = {
  totalMs: number;
  maxMs: number;
  timeouts: number;
  moveCount: number;
};

type SegmentSummary = {
  games: number;
  wins: number;
  draws: number;
  losses: number;
  avgPlies: number;
  repetitionRate: number;
  mateRate: number;
  avgCapturesPerGame: number;
  avgPawnMovesPerGame: number;
  earlyRepetitionCount: number;
  avgRepetitionPly: number;
  endReasons: Record<string, number>;
  timing: {
    hard: SideTimings;
    max: SideTimings;
  };
};

type SegmentTotals = {
  games: number;
  wins: number;
  draws: number;
  losses: number;
  plies: number;
  endReasons: Record<string, number>;
  captures: number;
  pawnMoves: number;
  repetitionEvents: number;
  repetitionPliesSum: number;
  earlyRepetitionCount: number;
  timing: {
    hard: TimingTotals;
    max: TimingTotals;
  };
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
  fenSuite: boolean;
  startFen: string | null;
  openingMoves: string[] | null;
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
  captures: number;
  pawnMoves: number;
  repetitionDiagnostics?: {
    repetitionFoldDetected: number;
    repetitionPly: number;
    lastMovesUci: string[];
    repeatedFen: string;
  };
  moveDiagnostics?: MoveDiagnosticsEntry[];
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
    fenSuite: boolean;
    baseSeed: number;
    outDir: string;
  };
  totals: {
    games: number;
    wins: number;
    draws: number;
    losses: number;
    avgPlies: number;
    repetitionRate: number;
    mateRate: number;
    avgCapturesPerGame: number;
    avgPawnMovesPerGame: number;
    earlyRepetitionCount: number;
    avgRepetitionPly: number;
    endReasons: Record<string, number>;
  };
  segments: {
    hardAsWhite: SegmentSummary;
    hardAsBlack: SegmentSummary;
  };
  timing: {
    hard: SideTimings;
    max: SideTimings;
  };
};

const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_HARD_MS = 1000;
const DEFAULT_MAX_MS = 10000;
const DEFAULT_MAX_PLIES = 200;
const DEFAULT_BASE_SEED = 1000;
const DEFAULT_SWAP = true;
const DEFAULT_FEN_SUITE = true;
const ENGINE_TIMEOUT_GRACE_MS = 80;
const MIN_PLIES_FOR_DRAW = 2;
const EARLY_REPETITION_PLY = 30;
const MAX_REROLLS = 3;

const REPORT_PATH = path.resolve('benchmarks/selfplay/SelfPlayReport.md');
const ROOT_OUTPUT_DIR = path.resolve('benchmarks/selfplay');

const OPENINGS: string[][] = [
  ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6'],
  ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5'],
  ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4'],
  ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'g8f6'],
  ['c2c4', 'e7e5', 'b1c3', 'g8f6', 'g2g3', 'd7d5'],
  ['g1f3', 'd7d5', 'g2g3', 'g8f6', 'f1g2', 'e7e6'],
  ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'b1c3', 'f8b4'],
  ['e2e4', 'c7c6', 'd2d4', 'd7d5', 'b1c3', 'd5e4'],
  ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'b1c3', 'f8b4'],
  ['d2d4', 'g8f6', 'c2c4', 'g7g6', 'b1c3', 'f8g7'],
  ['d2d4', 'g8f6', 'c2c4', 'c7c5', 'd4d5', 'e7e6'],
  ['e2e4', 'c7c5', 'g1f3', 'e7e6', 'd2d4', 'c5d4'],
  ['e2e4', 'e7e5', 'f1c4', 'b8c6', 'd2d3', 'g8f6'],
  ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'd2d4', 'e5d4'],
  ['d2d4', 'd7d5', 'g1f3', 'g8f6', 'c2c4', 'c7c6'],
  ['c2c4', 'g8f6', 'b1c3', 'e7e5', 'g2g3', 'f8b4'],
  ['e2e4', 'c7c5', 'g1f3', 'b8c6', 'd2d4', 'c5d4'],
  ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'g8f6'],
  ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'g1f3', 'd7d5'],
  ['e2e4', 'e7e5', 'g1f3', 'd7d6', 'd2d4', 'g8f6'],
  ['e2e4', 'g8f6', 'e4e5', 'f6d5', 'd2d4', 'd7d6'],
  ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'g1f3', 'b7b6'],
  ['e2e4', 'e7e5', 'b1c3', 'g8f6', 'f1c4', 'f8b4'],
  ['e2e4', 'd7d6', 'd2d4', 'g8f6', 'b1c3', 'g7g6']
];

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const PROMO_MAP: Record<string, PieceType> = {
  q: 'queen',
  r: 'rook',
  b: 'bishop',
  n: 'knight'
};

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

const FEN_SUITE = buildFenSuite(FEN_SEED_OPENINGS);

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
    swap: args.swap ?? DEFAULT_SWAP,
    fenSuite: args.fenSuite ?? DEFAULT_FEN_SUITE,
    outDir,
    baseSeed: args.baseSeed ?? DEFAULT_BASE_SEED
  };

  await fs.mkdir(outDir, { recursive: true });
  await fs.mkdir(ROOT_OUTPUT_DIR, { recursive: true });

  const runStart = new Date().toISOString();
  const endReasons = createEndReasonCounts();
  let totalPlies = 0;
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let totalCaptures = 0;
  let totalPawnMoves = 0;
  const segmentTotals = {
    hardAsWhite: createSegmentTotals(),
    hardAsBlack: createSegmentTotals()
  };
  const repetitionTotals = createRepetitionTotals();
  const timingTotals = {
    hard: createTimingTotals(),
    max: createTimingTotals()
  };

  const rounds = buildRounds(config.batchSize, config.swap);
  for (let index = 0; index < rounds.length; index += 1) {
    const round = rounds[index];
    const gameId = index + 1;
    const segment = round.white === 'hard' ? segmentTotals.hardAsWhite : segmentTotals.hardAsBlack;
    const baseSeed = config.baseSeed + index;
    let attempt = 0;
    let result: Awaited<ReturnType<typeof runSingleGame>>;
    let rerolled = false;

    while (true) {
      const start = selectStartPosition(config, gameId, attempt);
      result = await runSingleGame({
        gameId,
        round: round.round,
        opening: start.opening,
        startFen: start.fen,
        fenSuite: config.fenSuite,
        white: round.white,
        hardMs: config.hardMs,
        maxMs: config.maxMs,
        maxPlies: config.maxPlies,
        seed: baseSeed + attempt
      });

      const repetitionPly = result.repetitionDiagnostics?.repetitionPly;
      if (result.endReason === 'repetition' && repetitionPly !== undefined) {
        const isEarly = repetitionPly < EARLY_REPETITION_PLY;
        recordRepetitionStats(segment, repetitionTotals, repetitionPly, isEarly);
        if (isEarly && config.fenSuite && attempt < MAX_REROLLS) {
          attempt += 1;
          rerolled = true;
          console.log(
            `Game ${gameId.toString().padStart(4, '0')} early repetition at ply ${repetitionPly}; reroll ${attempt}/${MAX_REROLLS}`
          );
          continue;
        }
      }
      break;
    }

    totalPlies += result.plies;
    totalCaptures += result.captures;
    totalPawnMoves += result.pawnMoves;
    endReasons[result.endReason] = (endReasons[result.endReason] ?? 0) + 1;
    updateSegmentTotals(segment, result);
    if (result.outcome === 'win') {
      wins += 1;
    } else if (result.outcome === 'loss') {
      losses += 1;
    } else {
      draws += 1;
    }

    for (const side of ['hard', 'max'] as const) {
      updateTimingTotals(timingTotals[side], result.timings[side]);
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
    if (rerolled) {
      console.log(`Game ${gameSlug}: accepted after reroll (${result.result})`);
    }
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
    totalCaptures,
    totalPawnMoves,
    endReasons,
    segmentTotals,
    repetitionTotals,
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
  opening: string[] | null;
  startFen: string | null;
  fenSuite: boolean;
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
  captures: number;
  pawnMoves: number;
  repetitionDiagnostics?: {
    repetitionFoldDetected: number;
    repetitionPly: number;
    lastMovesUci: string[];
    repeatedFen: string;
  };
  log: GameLog;
  timings: { hard: SideTimings; max: SideTimings };
}> {
  const state = options.startFen ? createStateFromFen(options.startFen) : createInitialState();
  const pgnMoves: PgnMove[] = [];
  const moveTimings: MoveTiming[] = [];
  const moveDiagnostics: MoveDiagnosticsEntry[] = [];
  const moveHistoryUci: string[] = [];
  const moveStats = { captures: 0, pawnMoves: 0 };
  let lastMoveUci: string | null = null;
  let lastMoveSan: string | null = null;
  let plies = 0;
  let startFen = options.startFen ?? null;

  if (!options.startFen && options.opening && options.opening.length > 0) {
    const openingResult = applyOpening(
      state,
      options.opening,
      pgnMoves,
      moveHistoryUci,
      moveStats
    );
    plies = openingResult.plies;
    lastMoveUci = openingResult.lastMoveUci;
    lastMoveSan = openingResult.lastMoveSan;
    startFen = stateToFen(state);
  }
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
        const repetitionDiagnostics =
          endReason === 'repetition' ? buildRepetitionDiagnostics(state, plies, moveHistoryUci) : undefined;
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
          captures: moveStats.captures,
          pawnMoves: moveStats.pawnMoves,
          repetitionDiagnostics,
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
            fenSuite: options.fenSuite,
            startFen,
            openingMoves: options.opening ?? null,
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
            captures: moveStats.captures,
            pawnMoves: moveStats.pawnMoves,
            repetitionDiagnostics,
            moveDiagnostics,
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
      if (moveResult.diagnostics) {
        moveDiagnostics.push(
          formatMoveDiagnostics(moveResult.diagnostics, {
            ply: plies + 1,
            color: state.activeColor,
            side,
            timedOut: moveResult.timedOut
          })
        );
      }

      const san = buildSan(state, moveResult.move);
      pgnMoves.push({ moveNumber: state.fullmoveNumber, color: state.activeColor, san });
      updateMoveStats(state, moveResult.move, moveStats);
      const previousColor = state.activeColor;
      applyMove(state, moveResult.move);
      if (state.activeColor === previousColor) {
        throw new Error('Active color did not switch after move.');
      }
      plies += 1;
      const moveUci = moveToUci(moveResult.move);
      moveHistoryUci.push(moveUci);
      lastMoveUci = moveUci;
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
    captures: moveStats.captures,
    pawnMoves: moveStats.pawnMoves,
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
      fenSuite: options.fenSuite,
      startFen,
      openingMoves: options.opening ?? null,
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
      captures: moveStats.captures,
      pawnMoves: moveStats.pawnMoves,
      moveDiagnostics,
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
  diagnostics?: RootDiagnostics;
  message?: string;
}> {
  const start = performance.now();
  const seed = Math.floor(rng() * 1000000000);
  const diagnosticsGraceMs = options.side === 'hard' ? 150 : 250;
  const result = await runEngineWithTimeout(
    worker,
    state,
    {
      color: state.activeColor,
      difficulty: options.side,
      maxTimeMs: options.targetMs,
      maxDepth: options.side === 'max' ? MAX_THINKING_DEPTH_CAP : undefined,
      seed,
      diagnostics: true
    },
    options.targetMs,
    ENGINE_TIMEOUT_GRACE_MS,
    diagnosticsGraceMs
  );
  const elapsed = performance.now() - start;
  const timedOut = result.timedOut;
  if (result.error) {
    return {
      move: null,
      worker: result.worker,
      elapsedMs: elapsed,
      timedOut,
      diagnostics: result.diagnostics,
      message: result.error
    };
  }
  if (!result.move) {
    return {
      move: null,
      worker: result.worker,
      elapsedMs: elapsed,
      timedOut,
      diagnostics: result.diagnostics,
      message: 'Engine returned no move.'
    };
  }
  return {
    move: result.move,
    worker: result.worker,
    elapsedMs: elapsed,
    timedOut,
    diagnostics: result.diagnostics
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
  totalCaptures: number;
  totalPawnMoves: number;
  endReasons: Record<string, number>;
  segmentTotals: {
    hardAsWhite: SegmentTotals;
    hardAsBlack: SegmentTotals;
  };
  repetitionTotals: {
    repetitionEvents: number;
    repetitionPliesSum: number;
    earlyRepetitionCount: number;
  };
  timingTotals: {
    hard: TimingTotals;
    max: TimingTotals;
  };
}): RunSummary {
  const games = args.wins + args.draws + args.losses;
  const hardAvg = averageFromTotals(args.timingTotals.hard);
  const maxAvg = averageFromTotals(args.timingTotals.max);
  const repetitionRate = calculateRepetitionRate(args.endReasons, games);
  const mateRate = calculateRate(args.endReasons.mate ?? 0, games);
  const avgCapturesPerGame = games > 0 ? args.totalCaptures / games : 0;
  const avgPawnMovesPerGame = games > 0 ? args.totalPawnMoves / games : 0;
  const repetitionAvg =
    args.repetitionTotals.repetitionEvents > 0
      ? args.repetitionTotals.repetitionPliesSum / args.repetitionTotals.repetitionEvents
      : 0;
  const segments = {
    hardAsWhite: finalizeSegment(args.segmentTotals.hardAsWhite),
    hardAsBlack: finalizeSegment(args.segmentTotals.hardAsBlack)
  };

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
      fenSuite: args.config.fenSuite,
      baseSeed: args.config.baseSeed,
      outDir: args.config.outDir ?? ROOT_OUTPUT_DIR
    },
    totals: {
      games,
      wins: args.wins,
      draws: args.draws,
      losses: args.losses,
      avgPlies: games > 0 ? args.totalPlies / games : 0,
      repetitionRate,
      mateRate,
      avgCapturesPerGame,
      avgPawnMovesPerGame,
      earlyRepetitionCount: args.repetitionTotals.earlyRepetitionCount,
      avgRepetitionPly: repetitionAvg,
      endReasons: args.endReasons
    },
    segments,
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

function createTimingTotals(): TimingTotals {
  return { totalMs: 0, maxMs: 0, timeouts: 0, moveCount: 0 };
}

function createEndReasonCounts(): Record<string, number> {
  return {
    mate: 0,
    stalemate: 0,
    repetition: 0,
    fiftyMove: 0,
    other: 0
  };
}

function createSegmentTotals(): SegmentTotals {
  return {
    games: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    plies: 0,
    endReasons: createEndReasonCounts(),
    captures: 0,
    pawnMoves: 0,
    repetitionEvents: 0,
    repetitionPliesSum: 0,
    earlyRepetitionCount: 0,
    timing: {
      hard: createTimingTotals(),
      max: createTimingTotals()
    }
  };
}

function createRepetitionTotals(): {
  repetitionEvents: number;
  repetitionPliesSum: number;
  earlyRepetitionCount: number;
} {
  return { repetitionEvents: 0, repetitionPliesSum: 0, earlyRepetitionCount: 0 };
}

function updateTimingTotals(totals: TimingTotals, timing: SideTimings): void {
  totals.totalMs += timing.avgMs * timing.moveCount;
  totals.maxMs = Math.max(totals.maxMs, timing.maxMs);
  totals.timeouts += timing.timeouts;
  totals.moveCount += timing.moveCount;
}

function updateSegmentTotals(
  segment: SegmentTotals,
  result: {
    outcome: 'win' | 'loss' | 'draw';
    plies: number;
    endReason: string;
    timings: { hard: SideTimings; max: SideTimings };
    captures: number;
    pawnMoves: number;
  }
): void {
  segment.games += 1;
  segment.plies += result.plies;
  segment.captures += result.captures;
  segment.pawnMoves += result.pawnMoves;
  segment.endReasons[result.endReason] = (segment.endReasons[result.endReason] ?? 0) + 1;
  if (result.outcome === 'win') {
    segment.wins += 1;
  } else if (result.outcome === 'loss') {
    segment.losses += 1;
  } else {
    segment.draws += 1;
  }
  updateTimingTotals(segment.timing.hard, result.timings.hard);
  updateTimingTotals(segment.timing.max, result.timings.max);
}

function recordRepetitionStats(
  segment: SegmentTotals,
  totals: { repetitionEvents: number; repetitionPliesSum: number; earlyRepetitionCount: number },
  repetitionPly: number,
  isEarly: boolean
): void {
  segment.repetitionEvents += 1;
  segment.repetitionPliesSum += repetitionPly;
  totals.repetitionEvents += 1;
  totals.repetitionPliesSum += repetitionPly;
  if (isEarly) {
    segment.earlyRepetitionCount += 1;
    totals.earlyRepetitionCount += 1;
  }
}

function finalizeSegment(segment: SegmentTotals): SegmentSummary {
  const games = segment.games;
  const repetitionAvg =
    segment.repetitionEvents > 0 ? segment.repetitionPliesSum / segment.repetitionEvents : 0;
  const mateRate = calculateRate(segment.endReasons.mate ?? 0, games);
  const avgCapturesPerGame = games > 0 ? segment.captures / games : 0;
  const avgPawnMovesPerGame = games > 0 ? segment.pawnMoves / games : 0;
  return {
    games,
    wins: segment.wins,
    draws: segment.draws,
    losses: segment.losses,
    avgPlies: games > 0 ? segment.plies / games : 0,
    repetitionRate: calculateRepetitionRate(segment.endReasons, games),
    mateRate,
    avgCapturesPerGame,
    avgPawnMovesPerGame,
    earlyRepetitionCount: segment.earlyRepetitionCount,
    avgRepetitionPly: repetitionAvg,
    endReasons: segment.endReasons,
    timing: {
      hard: {
        avgMs: averageFromTotals(segment.timing.hard),
        maxMs: segment.timing.hard.maxMs,
        timeouts: segment.timing.hard.timeouts,
        moveCount: segment.timing.hard.moveCount
      },
      max: {
        avgMs: averageFromTotals(segment.timing.max),
        maxMs: segment.timing.max.maxMs,
        timeouts: segment.timing.max.timeouts,
        moveCount: segment.timing.max.moveCount
      }
    }
  };
}

function averageFromTotals(totals: TimingTotals): number {
  return totals.moveCount > 0 ? totals.totalMs / totals.moveCount : 0;
}

function calculateRate(count: number, games: number): number {
  if (games === 0) {
    return 0;
  }
  return (count / games) * 100;
}

function calculateRepetitionRate(endReasons: Record<string, number>, games: number): number {
  if (games === 0) {
    return 0;
  }
  const reps = endReasons.repetition ?? 0;
  return (reps / games) * 100;
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
  fenSuite?: boolean;
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
    fenSuite?: boolean;
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
    } else if (arg === '--no-swap') {
      result.swap = false;
    } else if (arg === '--fenSuite') {
      result.fenSuite = true;
    } else if (arg === '--no-fenSuite') {
      result.fenSuite = false;
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

function buildRepetitionDiagnostics(
  state: GameState,
  plies: number,
  moveHistoryUci: string[]
): {
  repetitionFoldDetected: number;
  repetitionPly: number;
  lastMovesUci: string[];
  repeatedFen: string;
} {
  const key = getPositionKey(state);
  const count = state.positionCounts?.get(key) ?? 0;
  return {
    repetitionFoldDetected: Math.min(3, Math.max(2, count)),
    repetitionPly: plies,
    lastMovesUci: moveHistoryUci.slice(-6),
    repeatedFen: stateToFen(state)
  };
}

function formatMoveDiagnostics(
  diagnostics: RootDiagnostics,
  context: { ply: number; color: Color; side: EngineSide; timedOut: boolean }
): MoveDiagnosticsEntry {
  return {
    ply: context.ply,
    color: context.color,
    side: context.side,
    timedOut: context.timedOut,
    chosenMoveReason: diagnostics.chosenMoveReason,
    bestRepeatKind: diagnostics.bestRepeatKind,
    bestIsRepeat: diagnostics.bestIsRepeat,
    rootTopMoves: diagnostics.rootTopMoves.map((entry) => ({
      uci: moveToUci(entry.move),
      score: entry.score,
      baseScore: entry.baseScore,
      isRepeat: entry.isRepeat,
      repeatCount: entry.repeatCount
    }))
  };
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
  const hardSegment = summary.segments.hardAsWhite;
  const maxSegment = summary.segments.hardAsBlack;
  const lines = [
    `Last updated: ${formatTimestampLine(summary.finishedAt)}`,
    `Config: hardMs=${summary.config.hardMs}, maxMs=${summary.config.maxMs}, batch=${summary.config.batchSize}, swap=${summary.config.swap}, fenSuite=${summary.config.fenSuite}`,
    `Commit: ${summary.commitSha}`,
    `Base seed: ${summary.config.baseSeed}`,
    `Output: ${summary.config.outDir}`,
    `Cumulative: ${totals.wins}-${totals.draws}-${totals.losses} (${totals.games} games)`,
    `Avg plies per game: ${avgPlies}`,
    `End reasons: mate=${end.mate}, stalemate=${end.stalemate}, repetition=${end.repetition}, 50-move=${end.fiftyMove}, other=${end.other}`,
    `Repetition rate: ${totals.repetitionRate.toFixed(1)}% | Mate rate: ${totals.mateRate.toFixed(1)}%`,
    `Decisiveness: avg captures=${totals.avgCapturesPerGame.toFixed(1)}, avg pawn moves=${totals.avgPawnMovesPerGame.toFixed(1)}`,
    `Early repetition count (<${EARLY_REPETITION_PLY} ply): ${totals.earlyRepetitionCount}`,
    `Avg repetition ply: ${totals.avgRepetitionPly.toFixed(1)}`,
    `Timing (Hard): avg=${hard.avgMs.toFixed(1)}ms, max=${hard.maxMs.toFixed(1)}ms, timeouts=${hard.timeouts}`,
    `Timing (Max): avg=${max.avgMs.toFixed(1)}ms, max=${max.maxMs.toFixed(1)}ms, timeouts=${max.timeouts}`,
    '',
    ...formatSegmentLines('Hard as White vs Max', hardSegment),
    '',
    ...formatSegmentLines('Max as White vs Hard', maxSegment),
    '',
    'Notes:',
    '- Deterministic base seed used; move-level seeds derived from a fixed RNG.',
    '- Opening suite: fixed UCI sequences applied before engine play; selection is seed-based.',
    '- FEN suite: FENs are derived from curated UCI sequences and selected by seed.',
    '- Early repetition rerolls are counted in repetition diagnostics but not in W/D/L totals.',
    '- Decisiveness metrics (captures/pawn moves) include opening or FEN start moves.',
    '- Segment W/D/L lines are reported from Hard\'s perspective.',
    '- SAN generation uses engine move legality; if SAN is missing for any move, check meta JSON.',
    ''
  ];
  return lines.join('\n');
}

function formatSegmentLines(label: string, segment: SegmentSummary): string[] {
  const end = segment.endReasons;
  return [
    `${label}: ${segment.wins}-${segment.draws}-${segment.losses} (${segment.games} games)`,
    `Avg plies: ${segment.avgPlies.toFixed(1)}`,
    `End reasons: mate=${end.mate}, stalemate=${end.stalemate}, repetition=${end.repetition}, 50-move=${end.fiftyMove}, other=${end.other}`,
    `Repetition rate: ${segment.repetitionRate.toFixed(1)}% | Mate rate: ${segment.mateRate.toFixed(1)}%`,
    `Decisiveness: avg captures=${segment.avgCapturesPerGame.toFixed(1)}, avg pawn moves=${segment.avgPawnMovesPerGame.toFixed(1)}`,
    `Early repetition count (<${EARLY_REPETITION_PLY} ply): ${segment.earlyRepetitionCount}`,
    `Avg repetition ply: ${segment.avgRepetitionPly.toFixed(1)}`,
    `Timing (Hard): avg=${segment.timing.hard.avgMs.toFixed(1)}ms, max=${segment.timing.hard.maxMs.toFixed(1)}ms, timeouts=${segment.timing.hard.timeouts}`,
    `Timing (Max): avg=${segment.timing.max.avgMs.toFixed(1)}ms, max=${segment.timing.max.maxMs.toFixed(1)}ms, timeouts=${segment.timing.max.timeouts}`
  ];
}

function formatTimestampLine(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const utc = date.toISOString();
  const eastern = formatEasternTime(date);
  return `${utc} (UTC) | ${eastern}`;
}

function formatEasternTime(date: Date): string {
  try {
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
    const map: Record<string, string> = {};
    for (const part of parts) {
      if (part.type !== 'literal') {
        map[part.type] = part.value;
      }
    }
    if (map.year && map.month && map.day && map.hour && map.minute && map.second) {
      return `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}:${map.second} ET`;
    }
    return formatter.format(date);
  } catch {
    return date.toLocaleString('en-US', { timeZone: 'America/New_York' });
  }
}

function buildRunReadme(): string {
  return [
    '# Scorpion Self-Play Benchmarks',
    '',
    'This folder contains a single self-play run (Hard vs Max).',
    '',
    '## How to run',
    '- npm run bench:selfplay',
    '- Optional: --batch 10 --hardMs 1000 --maxMs 10000 --swap/--no-swap --fenSuite/--no-fenSuite --outDir <path> --seed 1000',
    '',
    '## Metrics',
    '- W/D/L: results from Hard vs Max across all games.',
    '- Segments: Hard-as-White vs Max and Max-as-White vs Hard when using --swap.',
    '- Repetition rate: percent of games ending by repetition.',
    '- Decisiveness: avg captures/game, avg pawn moves/game, mate/repetition rates.',
    '- Early repetition count: repetition games that end before ply 30 (rerolls included).',
    '- Avg repetition ply: average ply of repetition endings (rerolls included).',
    '- Avg plies: total plies / games.',
    '- End reasons: mate, stalemate, repetition, 50-move, other.',
    '- Timing: per-side average and max move time, with timeout counts.',
    '- Openings: fixed UCI sequence applied before engine play; selection is seed-based.',
    '- FEN suite: start positions derived from curated UCI sequences; selection is seed-based.',
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

function pickOpening(baseSeed: number, gameId: number, attempt: number): string[] {
  if (OPENINGS.length === 0) {
    return [];
  }
  const index = Math.abs(baseSeed + gameId - 1 + attempt) % OPENINGS.length;
  return OPENINGS[index];
}

function pickFen(baseSeed: number, gameId: number, attempt: number): string | null {
  if (FEN_SUITE.length === 0) {
    return null;
  }
  const index = Math.abs(baseSeed + gameId - 1 + attempt) % FEN_SUITE.length;
  return FEN_SUITE[index];
}

function selectStartPosition(
  config: RunConfig,
  gameId: number,
  attempt: number
): { fen: string | null; opening: string[] | null } {
  if (config.fenSuite && FEN_SUITE.length > 0) {
    return { fen: pickFen(config.baseSeed, gameId, attempt), opening: null };
  }
  return { fen: null, opening: pickOpening(config.baseSeed, gameId, attempt) };
}

function updateMoveStats(
  state: GameState,
  move: Move,
  stats: { captures: number; pawnMoves: number }
): void {
  const piece = getPieceAt(state, move.from);
  if (piece?.type === 'pawn') {
    stats.pawnMoves += 1;
  }
  if (move.capturedId !== undefined || move.isEnPassant) {
    stats.captures += 1;
  }
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

function createStateFromFen(fen: string): GameState {
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 4) {
    throw new Error(`Invalid FEN: ${fen}`);
  }
  const [boardPart, activeColorRaw, castlingRaw, enPassantRaw, halfmoveRaw, fullmoveRaw] = parts;
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
  const enPassantTarget = enPassantRaw && enPassantRaw !== '-' ? parseSquare(enPassantRaw) : null;
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

function applyOpening(
  state: GameState,
  opening: string[],
  moves: PgnMove[],
  moveHistoryUci: string[],
  moveStats: { captures: number; pawnMoves: number }
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
    updateMoveStats(state, move, moveStats);
    applyMove(state, move);
    plies += 1;
    lastMoveUci = uci;
    lastMoveSan = san;
    moveHistoryUci.push(uci);
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

export async function runEngineWithTimeout(
  worker: Worker,
  state: GameState,
  options: {
    color: Color;
    difficulty: EngineSide;
    maxTimeMs?: number;
    maxDepth?: number;
    seed: number;
    diagnostics?: boolean;
  },
  targetMs: number,
  graceMs: number,
  diagnosticsGraceMs = 0
): Promise<{
  move: Move | null;
  error?: string;
  worker: Worker;
  timedOut: boolean;
  diagnostics?: RootDiagnostics;
}> {
  let activeWorker = worker;
  const requestId = Math.floor(Math.random() * 1e9);
  let timedOut = false;
  let resolved = false;

  const result = await new Promise<{
    move: Move | null;
    error?: string;
    worker: Worker;
    timedOut: boolean;
    diagnostics?: RootDiagnostics;
  }>((resolve) => {
    const attachedWorker = activeWorker;
    const allowDiagnosticsGrace = Boolean(options.diagnostics && diagnosticsGraceMs > 0);
    let diagnosticsTimer: ReturnType<typeof setTimeout> | null = null;
    const stopTimer = setTimeout(() => {
      attachedWorker.postMessage({ kind: 'stop', id: requestId });
    }, targetMs);

    const timeout = setTimeout(() => {
      timedOut = true;
      if (allowDiagnosticsGrace) {
        diagnosticsTimer = setTimeout(() => {
          if (resolved) {
            return;
          }
          cleanup();
          attachedWorker.terminate();
          activeWorker = createEngineWorker();
          resolved = true;
          resolve({ move: fallbackMove(state), worker: activeWorker, timedOut });
        }, diagnosticsGraceMs);
        return;
      }
      cleanup();
      attachedWorker.terminate();
      activeWorker = createEngineWorker();
      resolved = true;
      resolve({ move: fallbackMove(state), worker: activeWorker, timedOut });
    }, targetMs + graceMs);

    const cleanup = () => {
      clearTimeout(stopTimer);
      clearTimeout(timeout);
      if (diagnosticsTimer) {
        clearTimeout(diagnosticsTimer);
      }
      attachedWorker.off('message', onMessage);
      attachedWorker.off('error', onError);
    };

    const onMessage = (response: {
      id: number;
      move: Move | null;
      error?: string;
      diagnostics?: RootDiagnostics | null;
    }) => {
      if (response.id !== requestId) {
        return;
      }
      if (resolved) {
        return;
      }
      cleanup();
      resolved = true;
      resolve({
        move: response.move,
        error: response.error,
        worker: activeWorker,
        timedOut,
        diagnostics: response.diagnostics ?? undefined
      });
    };

    const onError = (error: unknown) => {
      if (resolved) {
        return;
      }
      cleanup();
      attachedWorker.terminate();
      activeWorker = createEngineWorker();
      resolved = true;
      resolve({
        move: null,
        error: error instanceof Error ? error.message : String(error),
        worker: activeWorker,
        timedOut,
        diagnostics: undefined
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

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
