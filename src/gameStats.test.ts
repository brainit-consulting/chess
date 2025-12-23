import { describe, expect, it } from 'vitest';
import { GameStats } from './gameStats';
import { addPiece, applyMove, createEmptyState } from './rules';

const sq = (file: number, rank: number) => ({ file, rank });

describe('GameStats', () => {
  it('adds capture points to the capturing side', () => {
    const state = createEmptyState();
    addPiece(state, 'king', 'w', sq(4, 0));
    addPiece(state, 'king', 'b', sq(4, 7));
    addPiece(state, 'rook', 'w', sq(0, 0));
    addPiece(state, 'pawn', 'b', sq(0, 7));

    const stats = new GameStats();
    stats.reset(state);

    applyMove(state, { from: sq(0, 0), to: sq(0, 7) });
    stats.updateAfterMove(state, 'w');

    const scores = stats.getScores();
    expect(scores.w).toBe(1);
    expect(scores.b).toBe(0);
  });
});
