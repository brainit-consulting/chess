import { describe, expect, it } from 'vitest';
import {
  addPiece,
  applyMove,
  createEmptyState,
  getAllLegalMoves,
  getGameStatus,
  getLegalMovesForSquare,
  getPieceAt
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

it('allows castling both directions for both colors when clear', () => {
  const state = createEmptyState();
  addPiece(state, 'king', 'w', sq(4, 0));
  addPiece(state, 'rook', 'w', sq(7, 0));
  addPiece(state, 'rook', 'w', sq(0, 0));
  addPiece(state, 'king', 'b', sq(4, 7));
  addPiece(state, 'rook', 'b', sq(7, 7));
  addPiece(state, 'rook', 'b', sq(0, 7));
  state.castlingRights = { wK: true, wQ: true, bK: true, bQ: true };

  const whiteMoves = getLegalMovesForSquare(state, sq(4, 0));
  expect(whiteMoves.some((move) => move.isCastle && move.to.file === 6)).toBe(true);
  expect(whiteMoves.some((move) => move.isCastle && move.to.file === 2)).toBe(true);

  const blackMoves = getLegalMovesForSquare(state, sq(4, 7));
  expect(blackMoves.some((move) => move.isCastle && move.to.file === 6)).toBe(true);
  expect(blackMoves.some((move) => move.isCastle && move.to.file === 2)).toBe(true);
});

it('exposes castling moves in all-legal-moves list', () => {
  const state = createEmptyState();
  addPiece(state, 'king', 'w', sq(4, 0));
  addPiece(state, 'rook', 'w', sq(7, 0));
  addPiece(state, 'rook', 'w', sq(0, 0));
  addPiece(state, 'king', 'b', sq(4, 7));
  state.castlingRights = { wK: true, wQ: true, bK: false, bQ: false };

  const moves = getAllLegalMoves(state, 'w');
  expect(
    moves.some((move) => move.isCastle && move.to.file === 6 && move.to.rank === 0)
  ).toBe(true);
});

it('moves king and rook to correct squares on castling', () => {
  const whiteState = createEmptyState();
  const whiteKingId = addPiece(whiteState, 'king', 'w', sq(4, 0));
  const whiteRookId = addPiece(whiteState, 'rook', 'w', sq(7, 0));
  addPiece(whiteState, 'king', 'b', sq(4, 7));
  whiteState.castlingRights = { wK: true, wQ: false, bK: false, bQ: false };

  const whiteCastle = getLegalMovesForSquare(whiteState, sq(4, 0)).find(
    (move) => move.isCastle && move.to.file === 6
  );
  expect(whiteCastle).toBeTruthy();
  if (whiteCastle) {
    applyMove(whiteState, whiteCastle);
    expect(getPieceAt(whiteState, sq(6, 0))?.type).toBe('king');
    expect(getPieceAt(whiteState, sq(5, 0))?.type).toBe('rook');
    expect(getPieceAt(whiteState, sq(7, 0))).toBeNull();
    expect(whiteState.pieces.get(whiteKingId)?.hasMoved).toBe(true);
    expect(whiteState.pieces.get(whiteRookId)?.hasMoved).toBe(true);
    expect(whiteState.castlingRights.wK).toBe(false);
    expect(whiteState.castlingRights.wQ).toBe(false);
  }

  const blackState = createEmptyState();
  const blackKingId = addPiece(blackState, 'king', 'b', sq(4, 7));
  const blackRookId = addPiece(blackState, 'rook', 'b', sq(0, 7));
  addPiece(blackState, 'king', 'w', sq(4, 0));
  blackState.castlingRights = { wK: false, wQ: false, bK: false, bQ: true };

  const blackCastle = getLegalMovesForSquare(blackState, sq(4, 7)).find(
    (move) => move.isCastle && move.to.file === 2
  );
  expect(blackCastle).toBeTruthy();
  if (blackCastle) {
    applyMove(blackState, blackCastle);
    expect(getPieceAt(blackState, sq(2, 7))?.type).toBe('king');
    expect(getPieceAt(blackState, sq(3, 7))?.type).toBe('rook');
    expect(getPieceAt(blackState, sq(0, 7))).toBeNull();
    expect(blackState.pieces.get(blackKingId)?.hasMoved).toBe(true);
    expect(blackState.pieces.get(blackRookId)?.hasMoved).toBe(true);
    expect(blackState.castlingRights.bK).toBe(false);
    expect(blackState.castlingRights.bQ).toBe(false);
  }
});

it('disallows castling when king or rook has moved', () => {
  const state = createEmptyState();
  addPiece(state, 'king', 'w', sq(4, 0));
  addPiece(state, 'rook', 'w', sq(7, 0));
  addPiece(state, 'king', 'b', sq(4, 7));
  state.castlingRights = { wK: true, wQ: false, bK: false, bQ: false };

  applyMove(state, { from: sq(7, 0), to: sq(7, 1) });
  state.activeColor = 'w';
  applyMove(state, { from: sq(7, 1), to: sq(7, 0) });

  const moves = getLegalMovesForSquare(state, sq(4, 0));
  expect(moves.some((move) => move.isCastle)).toBe(false);
});

it('disallows castling when pieces block the path', () => {
  const state = createEmptyState();
  addPiece(state, 'king', 'w', sq(4, 0));
  addPiece(state, 'rook', 'w', sq(7, 0));
  addPiece(state, 'bishop', 'w', sq(5, 0));
  addPiece(state, 'king', 'b', sq(4, 7));
  state.castlingRights = { wK: true, wQ: false, bK: false, bQ: false };

  const moves = getLegalMovesForSquare(state, sq(4, 0));
  expect(moves.some((move) => move.isCastle)).toBe(false);
});

it('disallows castling when the king is in check or would land in check', () => {
  const inCheck = createEmptyState();
  addPiece(inCheck, 'king', 'w', sq(4, 0));
  addPiece(inCheck, 'rook', 'w', sq(7, 0));
  addPiece(inCheck, 'king', 'b', sq(0, 7));
  addPiece(inCheck, 'rook', 'b', sq(4, 6));
  inCheck.castlingRights = { wK: true, wQ: false, bK: false, bQ: false };

  const inCheckMoves = getLegalMovesForSquare(inCheck, sq(4, 0));
  expect(inCheckMoves.some((move) => move.isCastle)).toBe(false);

  const landingCheck = createEmptyState();
  addPiece(landingCheck, 'king', 'w', sq(4, 0));
  addPiece(landingCheck, 'rook', 'w', sq(7, 0));
  addPiece(landingCheck, 'king', 'b', sq(0, 7));
  addPiece(landingCheck, 'rook', 'b', sq(6, 7));
  landingCheck.castlingRights = { wK: true, wQ: false, bK: false, bQ: false };

  const landingMoves = getLegalMovesForSquare(landingCheck, sq(4, 0));
  expect(landingMoves.some((move) => move.isCastle)).toBe(false);
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

it('detects insufficient material draws', () => {
  const onlyKings = createEmptyState();
  addPiece(onlyKings, 'king', 'w', sq(4, 0));
  addPiece(onlyKings, 'king', 'b', sq(4, 7));

  const kingsStatus = getGameStatus(onlyKings);
  expect(kingsStatus.status).toBe('draw');
  expect(kingsStatus.reason).toBe('insufficient material');

  const kingKnight = createEmptyState();
  addPiece(kingKnight, 'king', 'w', sq(4, 0));
  addPiece(kingKnight, 'knight', 'w', sq(2, 2));
  addPiece(kingKnight, 'king', 'b', sq(4, 7));

  const knightStatus = getGameStatus(kingKnight);
  expect(knightStatus.status).toBe('draw');

  const kingBishop = createEmptyState();
  addPiece(kingBishop, 'king', 'w', sq(4, 0));
  addPiece(kingBishop, 'bishop', 'w', sq(2, 2));
  addPiece(kingBishop, 'king', 'b', sq(4, 7));

  const bishopStatus = getGameStatus(kingBishop);
  expect(bishopStatus.status).toBe('draw');

  const bishopsOnly = createEmptyState();
  addPiece(bishopsOnly, 'king', 'w', sq(4, 0));
  addPiece(bishopsOnly, 'bishop', 'w', sq(1, 1));
  addPiece(bishopsOnly, 'king', 'b', sq(4, 7));
  addPiece(bishopsOnly, 'bishop', 'b', sq(6, 6));

  const bishopsStatus = getGameStatus(bishopsOnly);
  expect(bishopsStatus.status).toBe('draw');
});

it('detects threefold repetition draws', () => {
  const state = createEmptyState();
  addPiece(state, 'king', 'w', sq(4, 0));
  addPiece(state, 'rook', 'w', sq(0, 0));
  addPiece(state, 'king', 'b', sq(4, 7));
  addPiece(state, 'rook', 'b', sq(0, 7));

  const cycle = () => {
    applyMove(state, { from: sq(0, 0), to: sq(0, 1) });
    applyMove(state, { from: sq(0, 7), to: sq(0, 6) });
    applyMove(state, { from: sq(0, 1), to: sq(0, 0) });
    applyMove(state, { from: sq(0, 6), to: sq(0, 7) });
  };

  cycle();
  cycle();

  const status = getGameStatus(state);
  expect(status.status).toBe('draw');
  expect(status.reason).toBe('threefold repetition');
});
