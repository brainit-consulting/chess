import { Color, GameState, Move, getAllLegalMoves } from '../rules';
import { createHardTt, findBestMove, findBestMoveTimed } from './search';

export type AiDifficulty = 'easy' | 'medium' | 'hard' | 'max';

export const MAX_THINKING_DEPTH_CAP = 7;
export const MAX_THINKING_CAP_MS = 10000;
export const MAX_THINKING_HUMAN_VS_AI_MS = MAX_THINKING_CAP_MS;
export const MAX_THINKING_AI_VS_AI_MS = MAX_THINKING_CAP_MS;
const HARD_REPETITION_PENALTY_SCALE = 1;
const MAX_REPETITION_PENALTY_SCALE = 2;
const HARD_REPETITION_NUDGE_SCALE = 1;
const HARD_MICRO_QUIESCENCE_DEPTH = 1;

export type AiOptions = {
  color?: Color;
  difficulty?: AiDifficulty;
  seed?: number;
  rng?: () => number;
  playForWin?: boolean;
  recentPositions?: string[];
  repetitionPenaltyScale?: number;
  hardRepetitionNudgeScale?: number;
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

export function chooseMove(state: GameState, options: AiOptions = {}): Move | null {
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

  if (difficulty === 'max') {
    const maxTimeMs = options.maxTimeMs ?? MAX_THINKING_CAP_MS;
    const maxDepth = options.maxDepth ?? MAX_THINKING_DEPTH_CAP;
    return findBestMoveTimed(state, color, {
      maxDepth,
      maxTimeMs,
      rng,
      legalMoves,
      playForWin: options.playForWin,
      recentPositions: options.recentPositions,
      repetitionPenaltyScale,
      hardRepetitionNudgeScale,
      maxThinking: true,
      stopRequested: options.stopRequested,
      onProgress: options.onProgress
    });
  }

  const depth = options.depthOverride ?? DEPTH_BY_DIFFICULTY[difficulty];
  const maxTimeMs = difficulty === 'hard' ? options.maxTimeMs : undefined;
  const tt = difficulty === 'hard' ? createHardTt() : undefined;
  const microQuiescenceDepth =
    difficulty === 'hard' ? HARD_MICRO_QUIESCENCE_DEPTH : undefined;
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
      microQuiescenceDepth,
      tt,
      maxThinking: false,
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
    microQuiescenceDepth,
    tt,
    maxThinking: false,
    maxTimeMs,
    stopRequested: options.stopRequested
  });
}

function createSeededRng(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}
