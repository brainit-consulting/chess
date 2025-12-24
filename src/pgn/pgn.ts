import {
  Color,
  GameState,
  Move,
  Piece,
  PieceType,
  Square,
  applyMove,
  getAllLegalMoves,
  getGameStatus,
  getPieceAt
} from '../rules';

export type PgnMove = {
  moveNumber: number;
  color: Color;
  san: string;
};

type PgnHeader = {
  event: string;
  site: string;
  date: string;
  white: string;
  black: string;
  result: string;
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const PIECE_LETTERS: Record<PieceType, string> = {
  pawn: '',
  knight: 'N',
  bishop: 'B',
  rook: 'R',
  queen: 'Q',
  king: 'K'
};

export function buildSan(state: GameState, move: Move): string {
  const movingPiece = getPieceAt(state, move.from);
  if (!movingPiece) {
    return '';
  }

  const copy = cloneState(state);
  const moveCopy = cloneMove(move);
  applyMove(copy, moveCopy);
  const suffix = getCheckSuffix(copy);

  if (move.isCastle) {
    const castle = move.to.file === 6 ? 'O-O' : 'O-O-O';
    return `${castle}${suffix}`;
  }

  const destination = squareToAlgebraic(move.to);
  const capture = isCapture(state, move, movingPiece.color);

  if (movingPiece.type === 'pawn') {
    const file = FILES[move.from.file];
    let san = capture ? `${file}x${destination}` : destination;
    if (move.promotion) {
      san += `=${PIECE_LETTERS[move.promotion]}`;
    }
    return `${san}${suffix}`;
  }

  const pieceLetter = PIECE_LETTERS[movingPiece.type];
  const disambiguation = getDisambiguation(state, move, movingPiece);
  const captureMarker = capture ? 'x' : '';
  return `${pieceLetter}${disambiguation}${captureMarker}${destination}${suffix}`;
}

export function buildPgn(options: {
  moves: PgnMove[];
  white: string;
  black: string;
  result: string;
  event?: string;
  site?: string;
  date?: Date;
}): string {
  const header: PgnHeader = {
    event: options.event ?? '3D Chess',
    site: options.site ?? 'Local',
    date: formatDate(options.date ?? new Date()),
    white: options.white,
    black: options.black,
    result: options.result
  };

  const headerLines = [
    `[Event "${header.event}"]`,
    `[Site "${header.site}"]`,
    `[Date "${header.date}"]`,
    `[White "${header.white}"]`,
    `[Black "${header.black}"]`,
    `[Result "${header.result}"]`
  ];

  const movesText = formatMoves(options.moves, header.result);
  return `${headerLines.join('\n')}\n\n${movesText}\n`;
}

function formatMoves(moves: PgnMove[], result: string): string {
  const tokens: string[] = [];
  let lastMoveNumber = 0;
  let lastColor: Color | null = null;

  for (const move of moves) {
    if (move.color === 'w') {
      tokens.push(`${move.moveNumber}. ${move.san}`);
    } else if (lastColor === 'w' && lastMoveNumber === move.moveNumber) {
      const last = tokens.pop() ?? '';
      tokens.push(`${last} ${move.san}`.trim());
    } else {
      tokens.push(`${move.moveNumber}... ${move.san}`);
    }
    lastMoveNumber = move.moveNumber;
    lastColor = move.color;
  }

  return `${tokens.join(' ')} ${result}`.trim();
}

function squareToAlgebraic(square: Square): string {
  return `${FILES[square.file]}${square.rank + 1}`;
}

function getCheckSuffix(state: GameState): string {
  const status = getGameStatus(state);
  if (status.status === 'checkmate') {
    return '#';
  }
  if (status.status === 'check') {
    return '+';
  }
  return '';
}

function isCapture(state: GameState, move: Move, moverColor: Color): boolean {
  if (move.isEnPassant) {
    return true;
  }
  const target = getPieceAt(state, move.to);
  return Boolean(target && target.color !== moverColor);
}

function getDisambiguation(state: GameState, move: Move, piece: Piece): string {
  const candidates = getAllLegalMoves(state, piece.color).filter((candidate) => {
    if (candidate.from.file === move.from.file && candidate.from.rank === move.from.rank) {
      return false;
    }
    if (candidate.to.file !== move.to.file || candidate.to.rank !== move.to.rank) {
      return false;
    }
    const candidatePiece = getPieceAt(state, candidate.from);
    return candidatePiece?.type === piece.type;
  });

  if (candidates.length === 0) {
    return '';
  }

  const sameFile = candidates.some((candidate) => candidate.from.file === move.from.file);
  const sameRank = candidates.some((candidate) => candidate.from.rank === move.from.rank);

  if (!sameFile) {
    return FILES[move.from.file];
  }
  if (!sameRank) {
    return `${move.from.rank + 1}`;
  }
  return `${FILES[move.from.file]}${move.from.rank + 1}`;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}.${month}.${day}`;
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
    lastMove: state.lastMove ? cloneMove(state.lastMove) : null,
    positionCounts: state.positionCounts ? new Map(state.positionCounts) : new Map()
  };
}
