import { describe, expect, it } from 'vitest';
import { findBestMoveTimedDebug } from '../search';
import { addPiece, Color, createEmptyState, GameState, Move, PieceType, Square } from '../../rules';

const FILES = 'abcdefgh';
const MATE_SINGLE_FEN = '7k/5KQ1/8/8/8/8/8/8 w - - 0 1';
const MATE_MULTI_FEN = '7k/5Q2/6K1/8/8/8/8/8 w - - 0 1';

type MateProbeOptions = {
  maxDepth?: number;
  maxTimeMs?: number;
  seed?: number;
  now?: () => number;
};

function runMateProbe(fen: string, side: Color, options: MateProbeOptions = {}) {
  const state = parseFen(fen);
  state.activeColor = side;
  const rng = createSeededRng(options.seed ?? 1);

  return findBestMoveTimedDebug(state, side, {
    maxDepth: options.maxDepth ?? 7,
    maxTimeMs: options.maxTimeMs ?? 300,
    rng,
    maxThinking: true,
    now: options.now
  });
}

function parseFen(fen: string): GameState {
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 4) {
    throw new Error(`Invalid FEN: ${fen}`);
  }

  const [placement, active, castling, enPassant, halfmove, fullmove] = parts;
  const state = createEmptyState();

  const rows = placement.split('/');
  if (rows.length !== 8) {
    throw new Error(`Invalid FEN rows: ${fen}`);
  }

  rows.forEach((row, rowIndex) => {
    let file = 0;
    for (const symbol of row) {
      if (/\d/.test(symbol)) {
        file += Number(symbol);
        continue;
      }
      const { type, color } = pieceFromFen(symbol);
      addPiece(state, type, color, { file, rank: 7 - rowIndex });
      file += 1;
    }
    if (file !== 8) {
      throw new Error(`Invalid FEN row width: ${row}`);
    }
  });

  state.activeColor = active === 'b' ? 'b' : 'w';
  state.castlingRights = {
    wK: castling.includes('K'),
    wQ: castling.includes('Q'),
    bK: castling.includes('k'),
    bQ: castling.includes('q')
  };
  state.enPassantTarget = enPassant !== '-' ? squareFromAlgebraic(enPassant) : null;
  state.halfmoveClock = Number(halfmove ?? 0) || 0;
  state.fullmoveNumber = Number(fullmove ?? 1) || 1;

  return state;
}

function pieceFromFen(symbol: string): { type: PieceType; color: Color } {
  const lower = symbol.toLowerCase();
  const color: Color = symbol === lower ? 'b' : 'w';
  switch (lower) {
    case 'p':
      return { type: 'pawn', color };
    case 'n':
      return { type: 'knight', color };
    case 'b':
      return { type: 'bishop', color };
    case 'r':
      return { type: 'rook', color };
    case 'q':
      return { type: 'queen', color };
    case 'k':
      return { type: 'king', color };
    default:
      throw new Error(`Unknown FEN piece: ${symbol}`);
  }
}

function squareFromAlgebraic(square: string): Square {
  const file = FILES.indexOf(square[0]);
  const rank = Number(square[1]) - 1;
  if (file < 0 || rank < 0 || rank > 7) {
    throw new Error(`Invalid square: ${square}`);
  }
  return { file, rank };
}

function moveToUci(move: Move | null): string | null {
  if (!move) {
    return null;
  }
  const promo = move.promotion ? pieceToUci(move.promotion) : '';
  return `${FILES[move.from.file]}${move.from.rank + 1}${FILES[move.to.file]}${
    move.to.rank + 1
  }${promo}`;
}

function pieceToUci(type: PieceType): string {
  switch (type) {
    case 'queen':
      return 'q';
    case 'rook':
      return 'r';
    case 'bishop':
      return 'b';
    case 'knight':
      return 'n';
    default:
      return '';
  }
}

function createSeededRng(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

describe('mate probe helper', () => {
  it('detects a forced mate in a simple position', () => {
    const report = runMateProbe(MATE_SINGLE_FEN, 'w', { maxDepth: 5, now: () => 0 });
    expect(report.move).not.toBeNull();
    expect(report.mateInMoves).toBe(1);
  });

  it('prefers the shortest mate when multiple mates exist', () => {
    const report = runMateProbe(MATE_MULTI_FEN, 'w', { maxDepth: 5, now: () => 0 });
    const mateMoves = report.scoredMoves.filter((entry) => entry.mateInMoves !== null);
    expect(mateMoves.length).toBeGreaterThan(1);
    const minMate = Math.min(...mateMoves.map((entry) => entry.mateInMoves ?? 99));
    expect(report.mateInMoves).toBe(minMate);
  });
});

if (process.env.MATE_FEN) {
  it(
    'manual mate probe (env)',
    () => {
      const fen = process.env.MATE_FEN ?? '';
      const side = (process.env.MATE_SIDE ?? 'w') as Color;
      const maxDepth = Number(process.env.MATE_MAX_DEPTH ?? 7);
      const maxTimeMs = Number(process.env.MATE_MAX_TIME_MS ?? 300);
      const report = runMateProbe(fen, side, { maxDepth, maxTimeMs, seed: 1 });

      const output = {
        fen,
        side,
        bestMoveUci: moveToUci(report.move),
        mateDetected: report.mateInMoves !== null,
        mateInMoves: report.mateInMoves,
        mateInPly: report.mateInPly,
        depthCompleted: report.depthCompleted,
        ttEntries: report.ttEntries ?? 0
      };
      console.log(JSON.stringify(output, null, 2));
    },
    20000
  );
}
