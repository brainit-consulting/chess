import { describe, expect, it } from 'vitest';
import { chooseMove } from '../ai';
import {
  addPiece,
  createEmptyState,
  createInitialState,
  getAllLegalMoves,
  Square,
  Move
} from '../../rules';

const sq = (file: number, rank: number): Square => ({ file, rank });

function sameMove(a: Move, b: Move): boolean {
  return (
    a.from.file === b.from.file &&
    a.from.rank === b.from.rank &&
    a.to.file === b.to.file &&
    a.to.rank === b.to.rank &&
    a.promotion === b.promotion &&
    a.isCastle === b.isCastle &&
    a.isEnPassant === b.isEnPassant
  );
}

describe('AI move selection', () => {
  it('never selects an illegal move', () => {
    const state = createEmptyState();
    addPiece(state, 'king', 'w', sq(4, 0));
    addPiece(state, 'king', 'b', sq(4, 7));
    addPiece(state, 'rook', 'b', sq(0, 7));
    state.activeColor = 'b';

    const move = chooseMove(state, { difficulty: 'easy', seed: 42 });
    expect(move).not.toBeNull();
    if (!move) {
      throw new Error('Expected AI to return a move.');
    }

    const legalMoves = getAllLegalMoves(state, 'b');
    expect(legalMoves.some((candidate) => sameMove(candidate, move))).toBe(true);
  });

  it('responds with a move when legal moves exist', () => {
    const state = createInitialState();
    state.activeColor = 'b';

    const move = chooseMove(state, { difficulty: 'easy', seed: 7 });
    expect(move).not.toBeNull();
  });

  it('returns no move when checkmated or stalemated', () => {
    const checkmate = createEmptyState();
    addPiece(checkmate, 'king', 'b', sq(7, 7));
    addPiece(checkmate, 'king', 'w', sq(5, 5));
    addPiece(checkmate, 'queen', 'w', sq(6, 6));
    checkmate.activeColor = 'b';

    const mateMove = chooseMove(checkmate, { difficulty: 'easy', seed: 1 });
    expect(mateMove).toBeNull();

    const stalemate = createEmptyState();
    addPiece(stalemate, 'king', 'b', sq(7, 7));
    addPiece(stalemate, 'king', 'w', sq(5, 6));
    addPiece(stalemate, 'queen', 'w', sq(6, 5));
    stalemate.activeColor = 'b';

    const staleMove = chooseMove(stalemate, { difficulty: 'easy', seed: 1 });
    expect(staleMove).toBeNull();
  });
});
