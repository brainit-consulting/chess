import { describe, expect, it } from 'vitest';
import { buildPgn, buildSan } from '../pgn';
import { addPiece, createEmptyState, createInitialState, getLegalMovesForSquare } from '../../rules';

const sq = (file: number, rank: number) => ({ file, rank });

describe('SAN generation', () => {
  it('formats simple pawn moves', () => {
    const state = createInitialState();
    const moves = getLegalMovesForSquare(state, sq(4, 1));
    const e4 = moves.find((move) => move.to.file === 4 && move.to.rank === 3);
    if (!e4) {
      throw new Error('Expected e4 to be legal.');
    }
    expect(buildSan(state, e4)).toBe('e4');
  });

  it('formats pawn captures', () => {
    const state = createEmptyState();
    addPiece(state, 'king', 'w', sq(4, 0));
    addPiece(state, 'king', 'b', sq(4, 7));
    addPiece(state, 'pawn', 'w', sq(4, 3));
    addPiece(state, 'pawn', 'b', sq(3, 4));
    state.activeColor = 'w';

    const moves = getLegalMovesForSquare(state, sq(4, 3));
    const capture = moves.find((move) => move.to.file === 3 && move.to.rank === 4);
    if (!capture) {
      throw new Error('Expected exd5 capture to be legal.');
    }
    expect(buildSan(state, capture)).toBe('exd5');
  });

  it('formats castling', () => {
    const state = createEmptyState();
    addPiece(state, 'king', 'w', sq(4, 0));
    addPiece(state, 'rook', 'w', sq(7, 0));
    addPiece(state, 'king', 'b', sq(4, 7));
    state.castlingRights = { wK: true, wQ: false, bK: false, bQ: false };
    state.activeColor = 'w';

    const moves = getLegalMovesForSquare(state, sq(4, 0));
    const castle = moves.find((move) => move.isCastle);
    if (!castle) {
      throw new Error('Expected castling move to be legal.');
    }
    expect(buildSan(state, castle)).toBe('O-O');
  });

  it('adds check and checkmate suffixes', () => {
    const checkState = createEmptyState();
    addPiece(checkState, 'king', 'w', sq(0, 0));
    addPiece(checkState, 'king', 'b', sq(4, 7));
    addPiece(checkState, 'rook', 'w', sq(4, 0));
    checkState.activeColor = 'w';

    const rookMoves = getLegalMovesForSquare(checkState, sq(4, 0));
    const checkMove = rookMoves.find((move) => move.to.file === 4 && move.to.rank === 6);
    if (!checkMove) {
      throw new Error('Expected checking rook move.');
    }
    expect(buildSan(checkState, checkMove)).toBe('Re7+');

    const mateState = createEmptyState();
    addPiece(mateState, 'king', 'w', sq(6, 0));
    addPiece(mateState, 'queen', 'w', sq(7, 4));
    addPiece(mateState, 'rook', 'w', sq(7, 0));
    addPiece(mateState, 'king', 'b', sq(7, 7));
    mateState.activeColor = 'w';

    const queenMoves = getLegalMovesForSquare(mateState, sq(7, 4));
    const mateMove = queenMoves.find((move) => move.to.file === 7 && move.to.rank === 6);
    if (!mateMove) {
      throw new Error('Expected Qh7 checkmate move.');
    }
    expect(buildSan(mateState, mateMove)).toBe('Qh7#');
  });

  it('formats promotions with check', () => {
    const state = createEmptyState();
    addPiece(state, 'king', 'w', sq(4, 0));
    addPiece(state, 'king', 'b', sq(0, 7));
    addPiece(state, 'pawn', 'w', sq(4, 6));
    state.activeColor = 'w';

    const moves = getLegalMovesForSquare(state, sq(4, 6));
    const promote = moves.find((move) => move.promotion === 'queen');
    if (!promote) {
      throw new Error('Expected promotion move to be legal.');
    }
    expect(buildSan(state, promote)).toBe('e8=Q+');
  });

  it('adds disambiguation for ambiguous rooks', () => {
    const state = createEmptyState();
    addPiece(state, 'king', 'w', sq(4, 1));
    addPiece(state, 'king', 'b', sq(4, 7));
    addPiece(state, 'rook', 'w', sq(0, 0));
    addPiece(state, 'rook', 'w', sq(7, 0));
    state.activeColor = 'w';

    const moves = getLegalMovesForSquare(state, sq(0, 0));
    const rookMove = moves.find((move) => move.to.file === 4 && move.to.rank === 0);
    if (!rookMove) {
      throw new Error('Expected Rae1 move to be legal.');
    }
    expect(buildSan(state, rookMove)).toBe('Rae1');
  });
});

describe('PGN generation', () => {
  it('includes result headers and trailing result', () => {
    const pgn = buildPgn({
      moves: [
        { moveNumber: 1, color: 'w', san: 'e4' },
        { moveNumber: 1, color: 'b', san: 'e5' }
      ],
      white: 'White',
      black: 'Black',
      result: '1-0',
      date: new Date('2025-12-24T10:00:00Z')
    });

    expect(pgn).toContain('[Result "1-0"]');
    expect(pgn).toContain('1. e4 e5 1-0');
  });
});
