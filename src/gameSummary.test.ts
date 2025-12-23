import { describe, expect, it } from 'vitest';
import { addPiece, createEmptyState, getGameStatus } from './rules';
import { createGameSummary } from './gameSummary';

const sq = (file: number, rank: number) => ({ file, rank });

describe('createGameSummary', () => {
  it('returns a checkmate summary with winner and material', () => {
    const state = createEmptyState();
    addPiece(state, 'king', 'b', sq(7, 7));
    addPiece(state, 'king', 'w', sq(5, 5));
    addPiece(state, 'queen', 'w', sq(6, 6));
    state.activeColor = 'b';

    const status = getGameStatus(state);
    const summary = createGameSummary(state, status, { w: 9, b: 0 });

    expect(summary).not.toBeNull();
    expect(summary?.outcome).toContain('White');
    expect(summary?.material).toContain('White 9');
    expect(summary?.detail.length).toBeGreaterThan(0);
  });

  it('returns a stalemate summary', () => {
    const state = createEmptyState();
    addPiece(state, 'king', 'b', sq(7, 7));
    addPiece(state, 'king', 'w', sq(5, 6));
    addPiece(state, 'queen', 'w', sq(6, 5));
    state.activeColor = 'b';

    const status = getGameStatus(state);
    const summary = createGameSummary(state, status, { w: 3, b: 3 });

    expect(summary).not.toBeNull();
    expect(summary?.outcome).toContain('Draw');
  });

  it('returns a draw summary for insufficient material', () => {
    const state = createEmptyState();
    addPiece(state, 'king', 'w', sq(4, 0));
    addPiece(state, 'king', 'b', sq(4, 7));

    const status = getGameStatus(state);
    const summary = createGameSummary(state, status, { w: 0, b: 0 });

    expect(summary).not.toBeNull();
    expect(summary?.outcome).toContain('insufficient material');
  });
});
