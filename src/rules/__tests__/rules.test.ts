import { describe, expect, it } from 'vitest';
import {
  addPiece,
  applyMove,
  createEmptyState,
  getGameStatus,
  getLegalMovesForSquare
} from '../index';

const sq = (file: number, rank: number) => ({ file, rank });

it('allows kingside castling when clear and safe', () => {
  const state = createEmptyState();
  addPiece(state, 'king', 'w', sq(4, 0));
  addPiece(state, 'rook', 'w', sq(7, 0));
  addPiece(state, 'king', 'b', sq(4, 7));
  state.castlingRights = { wK: true, wQ: false, bK: false, bQ: false };

  const moves = getLegalMovesForSquare(state, sq(4, 0));
  expect(moves.some((move) => move.isCastle && move.to.file === 6)).toBe(true);
});

it('blocks castling through check', () => {
  const state = createEmptyState();
  addPiece(state, 'king', 'w', sq(4, 0));
  addPiece(state, 'rook', 'w', sq(7, 0));
  addPiece(state, 'king', 'b', sq(4, 7));
  addPiece(state, 'rook', 'b', sq(5, 7));
  state.castlingRights = { wK: true, wQ: false, bK: false, bQ: false };

  const moves = getLegalMovesForSquare(state, sq(4, 0));
  expect(moves.some((move) => move.isCastle)).toBe(false);
});

it('handles en passant capture and expiry', () => {
  const state = createEmptyState();
  addPiece(state, 'king', 'w', sq(4, 0));
  addPiece(state, 'king', 'b', sq(4, 7));
  addPiece(state, 'pawn', 'w', sq(4, 4));
  addPiece(state, 'pawn', 'b', sq(3, 6));

  state.activeColor = 'b';
  applyMove(state, { from: sq(3, 6), to: sq(3, 4) });

  const moves = getLegalMovesForSquare(state, sq(4, 4));
  const enPassant = moves.find((move) => move.isEnPassant);
  expect(enPassant).toBeTruthy();

  if (enPassant) {
    applyMove(state, enPassant);
    expect(state.board[4][3]).toBeNull();
  }

  addPiece(state, 'pawn', 'w', sq(0, 1));
  applyMove(state, { from: sq(0, 1), to: sq(0, 2) });
  expect(state.enPassantTarget).toBeNull();
});

it('offers promotion choices and applies selected type', () => {
  const state = createEmptyState();
  addPiece(state, 'king', 'w', sq(4, 0));
  addPiece(state, 'king', 'b', sq(4, 7));
  const pawnId = addPiece(state, 'pawn', 'w', sq(0, 6));

  const moves = getLegalMovesForSquare(state, sq(0, 6));
  expect(moves.filter((move) => move.promotion).length).toBe(4);

  const promoteToKnight = moves.find((move) => move.promotion === 'knight');
  if (promoteToKnight) {
    applyMove(state, promoteToKnight);
    const promoted = state.pieces.get(pawnId);
    expect(promoted?.type).toBe('knight');
  }
});

it('prevents pinned pieces from exposing the king', () => {
  const state = createEmptyState();
  addPiece(state, 'king', 'w', sq(4, 0));
  addPiece(state, 'rook', 'w', sq(4, 1));
  addPiece(state, 'rook', 'b', sq(4, 7));
  addPiece(state, 'king', 'b', sq(0, 7));

  const moves = getLegalMovesForSquare(state, sq(4, 1));
  expect(moves.some((move) => move.to.file === 3 && move.to.rank === 1)).toBe(false);
  expect(moves.some((move) => move.to.file === 5 && move.to.rank === 1)).toBe(false);
});

it('detects checkmate and stalemate', () => {
  const checkmate = createEmptyState();
  addPiece(checkmate, 'king', 'b', sq(7, 7));
  addPiece(checkmate, 'king', 'w', sq(5, 5));
  addPiece(checkmate, 'queen', 'w', sq(6, 6));
  checkmate.activeColor = 'b';

  const mateStatus = getGameStatus(checkmate);
  expect(mateStatus.status).toBe('checkmate');
  expect(mateStatus.winner).toBe('w');

  const stalemate = createEmptyState();
  addPiece(stalemate, 'king', 'b', sq(7, 7));
  addPiece(stalemate, 'king', 'w', sq(5, 6));
  addPiece(stalemate, 'queen', 'w', sq(6, 5));
  stalemate.activeColor = 'b';

  const staleStatus = getGameStatus(stalemate);
  expect(staleStatus.status).toBe('stalemate');
});
