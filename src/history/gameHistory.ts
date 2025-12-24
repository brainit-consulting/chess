import {
  Color,
  GameState,
  Move,
  Piece,
  PieceType,
  Square,
  applyMove,
  getGameStatus,
  getPieceAt
} from '../rules';
import { buildSan } from '../pgn/pgn';

export type HistoryMove = {
  moveNumber: number;
  color: Color;
  piece: PieceType;
  from: Square;
  to: Square;
  captured?: PieceType;
  isCapture: boolean;
  isCastle: boolean;
  isEnPassant: boolean;
  promotion?: PieceType;
  givesCheck: boolean;
  givesCheckmate: boolean;
  san: string;
  coord: string;
};

export type HistoryRow = {
  moveNumber: number;
  white?: string;
  black?: string;
};

export class GameHistory {
  private moves: HistoryMove[] = [];

  reset(): void {
    this.moves = [];
  }

  addMove(state: GameState, move: Move): HistoryMove {
    const mover = getPieceAt(state, move.from);
    if (!mover) {
      throw new Error('Missing moving piece for history.');
    }
    const san = buildSan(state, move);
    const coord = formatCoordinateMove(state, move, mover.type);
    const captured = resolveCapturedPiece(state, move);
    const status = getStatusAfterMove(state, move);
    const record: HistoryMove = {
      moveNumber: state.fullmoveNumber,
      color: state.activeColor,
      piece: mover.type,
      from: { ...move.from },
      to: { ...move.to },
      captured: captured ?? undefined,
      isCapture: Boolean(captured) || move.isEnPassant,
      isCastle: Boolean(move.isCastle),
      isEnPassant: Boolean(move.isEnPassant),
      promotion: move.promotion,
      givesCheck: status.status === 'check' || status.status === 'checkmate',
      givesCheckmate: status.status === 'checkmate',
      san,
      coord
    };
    this.moves.push(record);
    return record;
  }

  getMoves(): HistoryMove[] {
    return [...this.moves];
  }

  hasMoves(): boolean {
    return this.moves.length > 0;
  }

  getRows(): HistoryRow[] {
    const rows: HistoryRow[] = [];
    for (const move of this.moves) {
      if (move.color === 'w') {
        rows.push({ moveNumber: move.moveNumber, white: move.coord });
        continue;
      }
      const last = rows[rows.length - 1];
      if (last && last.moveNumber === move.moveNumber && !last.black) {
        last.black = move.coord;
      } else {
        rows.push({ moveNumber: move.moveNumber, black: move.coord });
      }
    }
    return rows;
  }
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const PROMOTION_LETTERS: Record<PieceType, string> = {
  queen: 'Q',
  rook: 'R',
  bishop: 'B',
  knight: 'N',
  pawn: '',
  king: ''
};

function formatCoordinateMove(state: GameState, move: Move, piece: PieceType): string {
  const pieceLetter = pieceLetterFor(piece);
  if (move.isCastle) {
    const side = move.to.file === 6 ? 'O-O' : 'O-O-O';
    return `${pieceLetter} ${side}`;
  }

  const from = squareToLabel(move.from);
  const to = squareToLabel(move.to);
  const target = getPieceAt(state, move.to);
  const isCapture = move.isEnPassant || (Boolean(target) && target.color !== state.activeColor);
  const separator = isCapture ? 'x' : '-';
  let label = `${pieceLetter} ${from}${separator}${to}`;

  if (move.promotion) {
    label += `=${PROMOTION_LETTERS[move.promotion]}`;
  }

  return label;
}

function squareToLabel(square: Square): string {
  return `${FILES[square.file]}${square.rank + 1}`;
}

function pieceLetterFor(type: PieceType): string {
  switch (type) {
    case 'pawn':
      return 'P';
    case 'knight':
      return 'N';
    case 'bishop':
      return 'B';
    case 'rook':
      return 'R';
    case 'queen':
      return 'Q';
    case 'king':
      return 'K';
  }
}

function resolveCapturedPiece(state: GameState, move: Move): PieceType | null {
  if (move.isEnPassant) {
    return 'pawn';
  }
  const target = getPieceAt(state, move.to);
  if (!target || target.color === state.activeColor) {
    return null;
  }
  return target.type;
}

function getStatusAfterMove(state: GameState, move: Move) {
  const next = cloneState(state);
  applyMove(next, { ...move });
  return getGameStatus(next);
}

function cloneState(state: GameState): GameState {
  const board = state.board.map((row) => row.slice());
  const pieces = new Map<number, Piece>();
  for (const [id, piece] of state.pieces) {
    pieces.set(id, { ...piece });
  }
  return {
    board,
    pieces,
    activeColor: state.activeColor,
    castlingRights: { ...state.castlingRights },
    enPassantTarget: state.enPassantTarget ? { ...state.enPassantTarget } : null,
    halfmoveClock: state.halfmoveClock,
    fullmoveNumber: state.fullmoveNumber,
    lastMove: state.lastMove ? { ...state.lastMove } : null,
    positionCounts: state.positionCounts ? new Map(state.positionCounts) : new Map()
  };
}
