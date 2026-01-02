import { Color, GameState, Move, getAllLegalMoves } from '../rules';
import {
  createHardTt,
  createOrderingState,
  findBestMove,
  findBestMoveTimed,
  findBestMoveTimedDebug,
  type RootDiagnostics,
  type SearchInstrumentation
} from './search';

export type AiDifficulty = 'easy' | 'medium' | 'hard' | 'max';

export const MAX_THINKING_DEPTH_CAP = 7;
export const MAX_THINKING_CAP_MS = 10000;
export const MAX_THINKING_HUMAN_VS_AI_MS = MAX_THINKING_CAP_MS;
export const MAX_THINKING_AI_VS_AI_MS = MAX_THINKING_CAP_MS;
const HARD_REPETITION_PENALTY_SCALE = 1;
const MAX_REPETITION_PENALTY_SCALE = 2;
const HARD_REPETITION_NUDGE_SCALE = 1;
const HARD_REPEAT_BAN_WINDOW_CP = 60;
const MAX_REPEAT_BAN_WINDOW_CP = 100;
const DRAW_HOLD_THRESHOLD = -80;
const HARD_TWO_PLY_REPEAT_PENALTY = 18;
const MAX_TWO_PLY_REPEAT_PENALTY = 30;
const TWO_PLY_REPEAT_TOP_N = 6;
const HARD_MICRO_QUIESCENCE_DEPTH = 1;
const HARD_CONTEMPT_CP = 10;
const MAX_CONTEMPT_CP = 20;

export type AiOptions = {
  color?: Color;
  difficulty?: AiDifficulty;
  seed?: number;
  rng?: () => number;
  playForWin?: boolean;
  recentPositions?: string[];
  repetitionPenaltyScale?: number;
  hardRepetitionNudgeScale?: number;
  contemptCp?: number;
  usePvs?: boolean;
  repeatBanWindowCp?: number;
  nnueMix?: number;
  instrumentation?: boolean;
  depthOverride?: number;
  maxTimeMs?: number;
  maxDepth?: number;
  stopRequested?: () => boolean;
  onProgress?: (update: { depth: number; move: Move | null; score: number | null }) => void;
};

const DEPTH_BY_DIFFICULTY: Record<AiDifficulty, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
  max: 3
};

type AiContext = {
  color: Color;
  legalMoves: Move[];
  rng: () => number;
  difficulty: AiDifficulty;
  repetitionPenaltyScale: number;
  hardRepetitionNudgeScale: number;
  repeatBanWindowCp: number;
  drawHoldThreshold: number;
  twoPlyRepeatPenalty: number;
  twoPlyRepeatTopN: number;
  contemptCp: number;
  usePvs: boolean;
  nnueMix?: number;
};

function resolveAiContext(state: GameState, options: AiOptions): AiContext | null {
  const color = options.color ?? 'b';
  const legalMoves = getAllLegalMoves(state, color);
  if (legalMoves.length === 0) {
    return null;
  }

  const rng =
    options.rng ?? (options.seed !== undefined ? createSeededRng(options.seed) : Math.random);
  const difficulty = options.difficulty ?? 'medium';
  const repetitionPenaltyScale =
    options.repetitionPenaltyScale ??
    (difficulty === 'max'
      ? MAX_REPETITION_PENALTY_SCALE
      : difficulty === 'hard'
        ? HARD_REPETITION_PENALTY_SCALE
        : 0);
  const hardRepetitionNudgeScale =
    options.hardRepetitionNudgeScale ??
    (difficulty === 'hard' ? HARD_REPETITION_NUDGE_SCALE : 0);
  const repeatBanWindowCp =
    options.repeatBanWindowCp ??
    (difficulty === 'max'
      ? MAX_REPEAT_BAN_WINDOW_CP
      : difficulty === 'hard'
        ? HARD_REPEAT_BAN_WINDOW_CP
        : 0);
  const drawHoldThreshold = DRAW_HOLD_THRESHOLD;
  const twoPlyRepeatPenalty =
    difficulty === 'max'
      ? MAX_TWO_PLY_REPEAT_PENALTY
      : difficulty === 'hard'
        ? HARD_TWO_PLY_REPEAT_PENALTY
        : 0;
  const twoPlyRepeatTopN = TWO_PLY_REPEAT_TOP_N;
  const contemptCp =
    options.contemptCp ??
    (difficulty === 'max'
      ? MAX_CONTEMPT_CP
      : difficulty === 'hard'
        ? HARD_CONTEMPT_CP
        : 0);
  const usePvs = options.usePvs ?? difficulty === 'max';
  const nnueMix = options.nnueMix;

  return {
    color,
    legalMoves,
    rng,
    difficulty,
    repetitionPenaltyScale,
    hardRepetitionNudgeScale,
    repeatBanWindowCp,
    drawHoldThreshold,
    twoPlyRepeatPenalty,
    twoPlyRepeatTopN,
    contemptCp,
    usePvs,
    nnueMix
  };
}

export type AiMoveWithDiagnostics = {
  move: Move | null;
  diagnostics: RootDiagnostics | null;
};

export type SearchMetrics = SearchInstrumentation;

export type AiMoveWithMetrics = {
  move: Move | null;
  diagnostics: RootDiagnostics | null;
  metrics: SearchMetrics | null;
};

function createSearchMetrics(): SearchMetrics {
  return {
    nodes: 0,
    cutoffs: 0,
    depthCompleted: 0,
    durationMs: 0,
    nps: 0,
    fallbackUsed: false,
    softStopUsed: false,
    hardStopUsed: false,
    stopReason: 'none'
  };
}

export function chooseMove(state: GameState, options: AiOptions = {}): Move | null {
  const context = resolveAiContext(state, options);
  if (!context) {
    return null;
  }

  const {
    color,
    legalMoves,
    rng,
    difficulty,
    repetitionPenaltyScale,
    hardRepetitionNudgeScale,
    repeatBanWindowCp,
    drawHoldThreshold,
    twoPlyRepeatPenalty,
    twoPlyRepeatTopN,
    contemptCp,
    usePvs,
    nnueMix
  } = context;

  if (difficulty === 'max') {
    const maxTimeMs = options.maxTimeMs ?? MAX_THINKING_CAP_MS;
    const maxDepth = options.maxDepth ?? MAX_THINKING_DEPTH_CAP;
    const ordering = createOrderingState(maxDepth + 4);
    return findBestMoveTimed(state, color, {
      maxDepth,
      maxTimeMs,
      rng,
      legalMoves,
      playForWin: options.playForWin,
      recentPositions: options.recentPositions,
      repetitionPenaltyScale,
      hardRepetitionNudgeScale,
      repeatBanWindowCp,
      drawHoldThreshold,
      twoPlyRepeatPenalty,
      twoPlyRepeatTopN,
      contemptCp,
      maxThinking: true,
      usePvs,
      nnueMix,
      ordering,
      stopRequested: options.stopRequested,
      onProgress: options.onProgress
    });
  }

  const depth = options.depthOverride ?? DEPTH_BY_DIFFICULTY[difficulty];
  const maxTimeMs = difficulty === 'hard' ? options.maxTimeMs : undefined;
  const tt = difficulty === 'hard' ? createHardTt() : undefined;
  const microQuiescenceDepth =
    difficulty === 'hard' ? HARD_MICRO_QUIESCENCE_DEPTH : undefined;
  const ordering = difficulty === 'hard' ? createOrderingState(depth + 2) : undefined;
  if (difficulty === 'hard' && maxTimeMs !== undefined) {
    if (typeof process !== 'undefined' && process.env?.BENCH_DEBUG === '1') {
      console.log('TIMED_HARD_USED');
    }
    return findBestMoveTimed(state, color, {
      maxDepth: depth,
      maxTimeMs,
      rng,
      legalMoves,
      playForWin: options.playForWin,
      recentPositions: options.recentPositions,
      repetitionPenaltyScale,
      hardRepetitionNudgeScale,
      repeatBanWindowCp,
      drawHoldThreshold,
      twoPlyRepeatPenalty,
      twoPlyRepeatTopN,
      contemptCp,
      microQuiescenceDepth,
      tt,
      maxThinking: false,
      usePvs,
      ordering,
      stopRequested: options.stopRequested
    });
  }

  return findBestMove(state, color, {
    depth,
    rng,
    legalMoves,
    playForWin: options.playForWin,
    recentPositions: options.recentPositions,
    repetitionPenaltyScale,
    hardRepetitionNudgeScale,
    repeatBanWindowCp,
    drawHoldThreshold,
    twoPlyRepeatPenalty,
    twoPlyRepeatTopN,
    contemptCp,
    microQuiescenceDepth,
    tt,
    maxThinking: false,
    usePvs,
    ordering,
    maxTimeMs,
    stopRequested: options.stopRequested
  });
}

export function chooseMoveWithDiagnostics(
  state: GameState,
  options: AiOptions = {}
): AiMoveWithDiagnostics {
  const context = resolveAiContext(state, options);
  if (!context) {
    return { move: null, diagnostics: null };
  }

  const {
    color,
    legalMoves,
    rng,
    difficulty,
    repetitionPenaltyScale,
    hardRepetitionNudgeScale,
    repeatBanWindowCp,
    drawHoldThreshold,
    twoPlyRepeatPenalty,
    twoPlyRepeatTopN,
    contemptCp,
    usePvs,
    nnueMix
  } = context;

  if (difficulty === 'max') {
    const maxTimeMs = options.maxTimeMs ?? MAX_THINKING_CAP_MS;
    const maxDepth = options.maxDepth ?? MAX_THINKING_DEPTH_CAP;
    const ordering = createOrderingState(maxDepth + 4);
    const report = findBestMoveTimedDebug(state, color, {
      maxDepth,
      maxTimeMs,
      rng,
      legalMoves,
      playForWin: options.playForWin,
      recentPositions: options.recentPositions,
      repetitionPenaltyScale,
      hardRepetitionNudgeScale,
      repeatBanWindowCp,
      drawHoldThreshold,
      twoPlyRepeatPenalty,
      twoPlyRepeatTopN,
      contemptCp,
      microQuiescenceDepth: undefined,
      maxThinking: true,
      usePvs,
      nnueMix,
      rootDiagnostics: true,
      ordering,
      stopRequested: options.stopRequested
    });
    return { move: report.move, diagnostics: report.rootDiagnostics ?? null };
  }

  const depth = options.depthOverride ?? DEPTH_BY_DIFFICULTY[difficulty];
  const maxTimeMs = difficulty === 'hard' ? options.maxTimeMs : undefined;
  const tt = difficulty === 'hard' ? createHardTt() : undefined;
  const microQuiescenceDepth =
    difficulty === 'hard' ? HARD_MICRO_QUIESCENCE_DEPTH : undefined;
  const ordering = difficulty === 'hard' ? createOrderingState(depth + 2) : undefined;
  if (difficulty === 'hard' && maxTimeMs !== undefined) {
    const report = findBestMoveTimedDebug(state, color, {
      maxDepth: depth,
      maxTimeMs,
      rng,
      legalMoves,
      playForWin: options.playForWin,
      recentPositions: options.recentPositions,
      repetitionPenaltyScale,
      hardRepetitionNudgeScale,
      repeatBanWindowCp,
      drawHoldThreshold,
      twoPlyRepeatPenalty,
      twoPlyRepeatTopN,
      contemptCp,
      microQuiescenceDepth,
      tt,
      maxThinking: false,
      usePvs,
      rootDiagnostics: true,
      ordering,
      stopRequested: options.stopRequested
    });
    return { move: report.move, diagnostics: report.rootDiagnostics ?? null };
  }

  const move = findBestMove(state, color, {
    depth,
    rng,
    legalMoves,
    playForWin: options.playForWin,
    recentPositions: options.recentPositions,
    repetitionPenaltyScale,
    hardRepetitionNudgeScale,
    repeatBanWindowCp,
    drawHoldThreshold,
    twoPlyRepeatPenalty,
    twoPlyRepeatTopN,
    contemptCp,
    microQuiescenceDepth,
    tt,
    maxThinking: false,
    usePvs,
    ordering,
    maxTimeMs,
    stopRequested: options.stopRequested
  });
  return { move, diagnostics: null };
}

export function chooseMoveWithMetrics(
  state: GameState,
  options: AiOptions = {}
): AiMoveWithMetrics {
  const context = resolveAiContext(state, options);
  if (!context) {
    return { move: null, diagnostics: null, metrics: null };
  }

  const {
    color,
    legalMoves,
    rng,
    difficulty,
    repetitionPenaltyScale,
    hardRepetitionNudgeScale,
    repeatBanWindowCp,
    drawHoldThreshold,
    twoPlyRepeatPenalty,
    twoPlyRepeatTopN,
    contemptCp,
    usePvs,
    nnueMix
  } = context;

  const metrics = createSearchMetrics();

  if (difficulty === 'max') {
    const maxTimeMs = options.maxTimeMs ?? MAX_THINKING_CAP_MS;
    const maxDepth = options.maxDepth ?? MAX_THINKING_DEPTH_CAP;
    const ordering = createOrderingState(maxDepth + 4);
    const move = findBestMoveTimed(state, color, {
      maxDepth,
      maxTimeMs,
      rng,
      legalMoves,
      playForWin: options.playForWin,
      recentPositions: options.recentPositions,
      repetitionPenaltyScale,
      hardRepetitionNudgeScale,
      repeatBanWindowCp,
      drawHoldThreshold,
      twoPlyRepeatPenalty,
      twoPlyRepeatTopN,
      contemptCp,
      maxThinking: true,
      usePvs,
      nnueMix,
      ordering,
      instrumentation: metrics,
      stopRequested: options.stopRequested
    });
    return { move, diagnostics: null, metrics };
  }

  const depth = options.depthOverride ?? DEPTH_BY_DIFFICULTY[difficulty];
  const maxTimeMs = difficulty === 'hard' ? options.maxTimeMs : undefined;
  const tt = difficulty === 'hard' ? createHardTt() : undefined;
  const microQuiescenceDepth =
    difficulty === 'hard' ? HARD_MICRO_QUIESCENCE_DEPTH : undefined;
  const ordering = difficulty === 'hard' ? createOrderingState(depth + 2) : undefined;
  if (difficulty === 'hard' && maxTimeMs !== undefined) {
    const move = findBestMoveTimed(state, color, {
      maxDepth: depth,
      maxTimeMs,
      rng,
      legalMoves,
      playForWin: options.playForWin,
      recentPositions: options.recentPositions,
      repetitionPenaltyScale,
      hardRepetitionNudgeScale,
      repeatBanWindowCp,
      drawHoldThreshold,
      twoPlyRepeatPenalty,
      twoPlyRepeatTopN,
      contemptCp,
      microQuiescenceDepth,
      tt,
      maxThinking: false,
      usePvs,
      ordering,
      instrumentation: metrics,
      stopRequested: options.stopRequested
    });
    return { move, diagnostics: null, metrics };
  }

  const move = findBestMove(state, color, {
    depth,
    rng,
    legalMoves,
    playForWin: options.playForWin,
    recentPositions: options.recentPositions,
    repetitionPenaltyScale,
    hardRepetitionNudgeScale,
    repeatBanWindowCp,
    drawHoldThreshold,
    twoPlyRepeatPenalty,
    twoPlyRepeatTopN,
    contemptCp,
    microQuiescenceDepth,
    tt,
    maxThinking: false,
    usePvs,
    ordering,
    instrumentation: metrics,
    maxTimeMs,
    stopRequested: options.stopRequested
  });
  return { move, diagnostics: null, metrics };
}

function createSeededRng(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}
