import { Color, GameState, Move, getAllLegalMoves } from '../rules';
import { findBestMove } from './search';

export type AiDifficulty = 'easy' | 'medium' | 'hard';

export type AiOptions = {
  color?: Color;
  difficulty?: AiDifficulty;
  seed?: number;
  rng?: () => number;
  playForWin?: boolean;
  recentPositions?: string[];
  depthOverride?: number;
};

const DEPTH_BY_DIFFICULTY: Record<AiDifficulty, number> = {
  easy: 1,
  medium: 2,
  hard: 3
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
  const depth = options.depthOverride ?? DEPTH_BY_DIFFICULTY[difficulty];

  return findBestMove(state, color, {
    depth,
    rng,
    legalMoves,
    playForWin: options.playForWin,
    recentPositions: options.recentPositions
  });
}

function createSeededRng(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}
