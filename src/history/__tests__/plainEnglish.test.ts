import { describe, expect, it } from 'vitest';
import { buildPlainEnglishLines } from '../plainEnglish';
import { HistoryMove } from '../gameHistory';

const move = (partial: Partial<HistoryMove>): HistoryMove => ({
  moveNumber: 1,
  color: 'w',
  piece: 'pawn',
  from: { file: 4, rank: 1 },
  to: { file: 4, rank: 3 },
  captured: undefined,
  isCapture: false,
  isCastle: false,
  isEnPassant: false,
  promotion: undefined,
  givesCheck: false,
  givesCheckmate: false,
  san: 'e4',
  coord: 'P e2-e4',
  ...partial
});

describe('Plain English history', () => {
  it('formats captures with check', () => {
    const lines = buildPlainEnglishLines([
      move({
        piece: 'queen',
        from: { file: 7, rank: 4 },
        to: { file: 7, rank: 3 },
        isCapture: true,
        captured: 'queen',
        givesCheck: true
      })
    ]);
    expect(lines[0]).toBe('1. White queen h5xh4 (captures queen, check)');
  });

  it('formats castling with note', () => {
    const lines = buildPlainEnglishLines([
      move({
        piece: 'king',
        from: { file: 4, rank: 0 },
        to: { file: 6, rank: 0 },
        isCastle: true
      })
    ]);
    expect(lines[0]).toBe('1. White king castles kingside (castle kingside)');
  });

  it('formats promotions with checkmate', () => {
    const lines = buildPlainEnglishLines([
      move({
        piece: 'pawn',
        from: { file: 4, rank: 6 },
        to: { file: 4, rank: 7 },
        promotion: 'queen',
        givesCheckmate: true
      })
    ]);
    expect(lines[0]).toBe('1. White pawn e7->e8 (promotion to queen, checkmate)');
  });

  it('formats en passant captures', () => {
    const lines = buildPlainEnglishLines([
      move({
        piece: 'pawn',
        from: { file: 4, rank: 4 },
        to: { file: 3, rank: 5 },
        isCapture: true,
        captured: 'pawn',
        isEnPassant: true
      })
    ]);
    expect(lines[0]).toBe('1. White pawn e5xd6 (captures pawn, en passant)');
  });

  it('pairs white and black moves', () => {
    const lines = buildPlainEnglishLines([
      move({ piece: 'pawn', from: { file: 4, rank: 1 }, to: { file: 4, rank: 3 } }),
      move({
        color: 'b',
        piece: 'pawn',
        from: { file: 4, rank: 6 },
        to: { file: 4, rank: 4 },
        moveNumber: 1
      })
    ]);
    expect(lines[0]).toBe('1. White pawn e2->e4; Black pawn e7->e5');
  });
});
