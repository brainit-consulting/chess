import { describe, expect, it } from 'vitest';
import { findBestMoveTimedDebug } from '../search';
import {
  applyMove,
  Color,
  createInitialState,
  GameState,
  getAllLegalMoves,
  getPieceAt,
  getPositionKey,
  isInCheck,
  Piece,
  Move,
  PieceType,
  Square
} from '../../rules';

const FILES = 'abcdefgh';

type GeneratorConfig = {
  attempts: number;
  minPlies: number;
  maxPlies: number;
  maxDepth: number;
  seed: number;
  maxMs: number;
  searchMs: number;
};

const DEFAULT_CONFIG: GeneratorConfig = {
  attempts: 1500,
  minPlies: 10,
  maxPlies: 28,
  maxDepth: 6,
  seed: 1234,
  maxMs: 12000,
  searchMs: 120
};

describe('mate generator (dev-only)', () => {
  const enabled = process.env.MATE_FIND === '1';
  const testFn = enabled ? it : it.skip;

  testFn('finds a position with multiple mate lengths', () => {
    // Limitations: this is a probabilistic search from random plies of the initial
    // position. With tight time/attempt limits it may fail to find a qualifying FEN.
    // If it fails, increase MATE_FIND_ATTEMPTS, MATE_FIND_MAX_DEPTH, and/or
    // MATE_FIND_MAX_MS (and optionally MATE_FIND_SEARCH_MS) before treating it
    // as a regression. This is dev-only and skipped unless MATE_FIND=1.
    const config = loadConfig();
    const rng = createSeededRng(config.seed);
    const start = Date.now();

    for (let attempt = 0; attempt < config.attempts; attempt += 1) {
      if (Date.now() - start > config.maxMs) {
        break;
      }
      const state = createInitialState();
      const plies = randomInt(rng, config.minPlies, config.maxPlies);

      if (!playRandomPlies(state, plies, rng)) {
        continue;
      }

      const report = findBestMoveTimedDebug(state, state.activeColor, {
        maxDepth: config.maxDepth,
        maxTimeMs: config.searchMs,
        rng,
        maxThinking: true,
        now: Date.now
      });

      const mates = report.scoredMoves.filter((entry) => entry.mateInMoves !== null);
      if (mates.length < 2 || !report.move) {
        continue;
      }

      const mateDistances = mates.map((entry) => entry.mateInMoves ?? 0);
      const minMate = Math.min(...mateDistances);
      const maxMate = Math.max(...mateDistances);
      if (minMate === maxMate) {
        continue;
      }

      const best = report.scoredMoves.find((entry) => sameMove(entry.move, report.move));
      if (!best) {
        continue;
      }

      const fen = toFen(state);
      const summary = mates
        .map((entry) => `${moveToUci(entry.move)}: M${entry.mateInMoves}`)
        .join(', ');

      console.log(
        JSON.stringify(
          {
            fen,
            side: state.activeColor,
            bestMove: moveToUci(report.move),
            bestMateInMoves: best.mateInMoves,
            mates: summary,
            positionKey: getPositionKey(state)
          },
          null,
          2
        )
      );

      expect(best.mateInMoves).toBe(minMate);
      return;
    }

    throw new Error(
      'No suitable position found. Increase MATE_FIND_ATTEMPTS, MATE_FIND_MAX_DEPTH, or MATE_FIND_MAX_MS.'
    );
  });
});

function playRandomPlies(state: GameState, plies: number, rng: () => number): boolean {
  for (let ply = 0; ply < plies; ply += 1) {
    const moves = getAllLegalMoves(state, state.activeColor);
    if (moves.length === 0) {
      return false;
    }
    const tactical = moves.filter(
      (move) => isCaptureMove(state, move) || givesCheck(state, move, state.activeColor)
    );
    const pool = rng() < 0.4 && tactical.length > 0 ? tactical : moves;
    const index = Math.floor(rng() * pool.length);
    applyMove(state, pool[index]);
  }
  return true;
}

function isCaptureMove(state: GameState, move: Move): boolean {
  if (move.isEnPassant || move.capturedId) {
    return true;
  }
  return Boolean(getPieceAt(state, move.to));
}

function givesCheck(state: GameState, move: Move, color: Color): boolean {
  const next = cloneState(state);
  next.activeColor = color;
  applyMove(next, move);
  return isInCheck(next, opponentColor(color));
}

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

function opponentColor(color: Color): Color {
  return color === 'w' ? 'b' : 'w';
}

function moveToUci(move: Move): string {
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

function toFen(state: GameState): string {
  const rows: string[] = [];
  for (let rank = 7; rank >= 0; rank -= 1) {
    let empty = 0;
    let row = '';
    for (let file = 0; file < 8; file += 1) {
      const id = state.board[rank][file];
      if (!id) {
        empty += 1;
        continue;
      }
      if (empty > 0) {
        row += empty.toString();
        empty = 0;
      }
      const piece = state.pieces.get(id);
      if (!piece) {
        continue;
      }
      row += pieceToFenChar(piece.type, piece.color);
    }
    if (empty > 0) {
      row += empty.toString();
    }
    rows.push(row);
  }

  const castling = [
    state.castlingRights.wK ? 'K' : '',
    state.castlingRights.wQ ? 'Q' : '',
    state.castlingRights.bK ? 'k' : '',
    state.castlingRights.bQ ? 'q' : ''
  ]
    .join('')
    .trim();
  const enPassant = state.enPassantTarget
    ? `${FILES[state.enPassantTarget.file]}${state.enPassantTarget.rank + 1}`
    : '-';
  const castlingField = castling.length > 0 ? castling : '-';

  return `${rows.join('/')} ${state.activeColor} ${castlingField} ${enPassant} ${state.halfmoveClock} ${state.fullmoveNumber}`;
}

function pieceToFenChar(type: PieceType, color: Color): string {
  const char = (() => {
    switch (type) {
      case 'pawn':
        return 'p';
      case 'knight':
        return 'n';
      case 'bishop':
        return 'b';
      case 'rook':
        return 'r';
      case 'queen':
        return 'q';
      case 'king':
        return 'k';
      default:
        return 'p';
    }
  })();
  return color === 'w' ? char.toUpperCase() : char;
}

function cloneState(state: GameState): GameState {
  const board = state.board.map((row) => row.slice());
  const clonedPieces = new Map<number, Piece>();
  for (const [id, piece] of state.pieces) {
    clonedPieces.set(id, { ...piece });
  }
  return {
    board,
    pieces: clonedPieces,
    activeColor: state.activeColor,
    castlingRights: { ...state.castlingRights },
    enPassantTarget: state.enPassantTarget ? { ...state.enPassantTarget } : null,
    halfmoveClock: state.halfmoveClock,
    fullmoveNumber: state.fullmoveNumber,
    lastMove: state.lastMove ? cloneMove(state.lastMove) : null
  };
}

function cloneMove(move: Move): Move {
  return {
    from: { ...move.from },
    to: { ...move.to },
    promotion: move.promotion,
    isCastle: move.isCastle,
    isEnPassant: move.isEnPassant,
    capturedId: move.capturedId
  };
}

function loadConfig(): GeneratorConfig {
  return {
    attempts: Number(process.env.MATE_FIND_ATTEMPTS ?? DEFAULT_CONFIG.attempts),
    minPlies: Number(process.env.MATE_FIND_MIN_PLIES ?? DEFAULT_CONFIG.minPlies),
    maxPlies: Number(process.env.MATE_FIND_MAX_PLIES ?? DEFAULT_CONFIG.maxPlies),
    maxDepth: Number(process.env.MATE_FIND_MAX_DEPTH ?? DEFAULT_CONFIG.maxDepth),
    seed: Number(process.env.MATE_FIND_SEED ?? DEFAULT_CONFIG.seed),
    maxMs: Number(process.env.MATE_FIND_MAX_MS ?? DEFAULT_CONFIG.maxMs),
    searchMs: Number(process.env.MATE_FIND_SEARCH_MS ?? DEFAULT_CONFIG.searchMs)
  };
}

function randomInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function createSeededRng(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}
