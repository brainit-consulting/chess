import {
  Color,
  GameState,
  PieceType,
  findKingSquare,
  getAllLegalMoves,
  getPieceSquares,
  isInCheck
} from '../rules';

export const PIECE_VALUES: Record<PieceType, number> = {
  pawn: 100,
  knight: 320,
  bishop: 330,
  rook: 500,
  queen: 900,
  king: 20000
};

const MOBILITY_WEIGHT = 2;
const CHECK_PENALTY = 50;
const OPENING_FULLMOVE_LIMIT = 10;
const KING_HOME_BONUS = 20;
const KING_CASTLED_BONUS = 35;
const KING_MOVE_PENALTY = 8;
const PAWN_SHIELD_PENALTY = 8;
const EARLY_QUEEN_PENALTY = 20;

const KNIGHT_PST = [
  -50, -40, -30, -30, -30, -30, -40, -50,
  -40, -20, 0, 0, 0, 0, -20, -40,
  -30, 0, 10, 15, 15, 10, 0, -30,
  -30, 5, 15, 20, 20, 15, 5, -30,
  -30, 0, 15, 20, 20, 15, 0, -30,
  -30, 5, 10, 15, 15, 10, 5, -30,
  -40, -20, 0, 5, 5, 0, -20, -40,
  -50, -40, -30, -30, -30, -30, -40, -50
];

const BISHOP_PST = [
  -20, -10, -10, -10, -10, -10, -10, -20,
  -10, 0, 0, 0, 0, 0, 0, -10,
  -10, 0, 5, 10, 10, 5, 0, -10,
  -10, 5, 5, 10, 10, 5, 5, -10,
  -10, 0, 10, 10, 10, 10, 0, -10,
  -10, 10, 10, 10, 10, 10, 10, -10,
  -10, 5, 0, 0, 0, 0, 5, -10,
  -20, -10, -10, -10, -10, -10, -10, -20
];

type EvalOptions = {
  maxThinking?: boolean;
};

export function evaluateState(
  state: GameState,
  perspective: Color,
  options: EvalOptions = {}
): number {
  let material = 0;
  for (const piece of state.pieces.values()) {
    const value = PIECE_VALUES[piece.type];
    material += piece.color === 'w' ? value : -value;
  }

  const whiteMoves = getAllLegalMoves(state, 'w').length;
  const blackMoves = getAllLegalMoves(state, 'b').length;
  const mobility = (whiteMoves - blackMoves) * MOBILITY_WEIGHT;

  let checkScore = 0;
  if (isInCheck(state, 'w')) {
    checkScore -= CHECK_PENALTY;
  }
  if (isInCheck(state, 'b')) {
    checkScore += CHECK_PENALTY;
  }

  const maxScore = options.maxThinking ? evaluateMaxThinking(state) : 0;
  const scoreForWhite = material + mobility + checkScore + maxScore;
  return perspective === 'w' ? scoreForWhite : -scoreForWhite;
}

function evaluateMaxThinking(state: GameState): number {
  const squares = getPieceSquares(state);
  return (
    kingSafetyScore(state, squares, 'w') -
    kingSafetyScore(state, squares, 'b') +
    earlyQueenScore(state, squares, 'w') -
    earlyQueenScore(state, squares, 'b') +
    pieceSquareScore(state, squares, 'w') -
    pieceSquareScore(state, squares, 'b')
  );
}

function kingSafetyScore(
  state: GameState,
  squares: Map<number, { file: number; rank: number }>,
  color: Color
): number {
  const kingSquare = findKingSquare(state, color);
  if (!kingSquare) {
    return 0;
  }

  const isOpening = state.fullmoveNumber <= OPENING_FULLMOVE_LIMIT;
  if (!isOpening) {
    return 0;
  }

  const homeRank = color === 'w' ? 0 : 7;
  const homeSquare = { file: 4, rank: homeRank };
  const castled =
    (color === 'w' && kingSquare.rank === 0 && (kingSquare.file === 2 || kingSquare.file === 6)) ||
    (color === 'b' && kingSquare.rank === 7 && (kingSquare.file === 2 || kingSquare.file === 6));

  let score = 0;
  if (castled) {
    score += KING_CASTLED_BONUS;
  } else if (kingSquare.file === homeSquare.file && kingSquare.rank === homeSquare.rank) {
    score += KING_HOME_BONUS;
  }

  if (!castled) {
    const distance =
      Math.abs(kingSquare.file - homeSquare.file) +
      Math.abs(kingSquare.rank - homeSquare.rank);
    if (distance > 0) {
      score -= distance * KING_MOVE_PENALTY;
    }
  }

  let missingShield = 0;
  for (const file of [5, 6, 7]) {
    if (!hasPawnOnFile(state, squares, color, file)) {
      missingShield += 1;
    }
  }
  score -= missingShield * PAWN_SHIELD_PENALTY;
  return score;
}

function earlyQueenScore(
  state: GameState,
  squares: Map<number, { file: number; rank: number }>,
  color: Color
): number {
  if (state.fullmoveNumber > OPENING_FULLMOVE_LIMIT) {
    return 0;
  }

  const queenEntry = [...state.pieces.values()].find(
    (piece) => piece.color === color && piece.type === 'queen'
  );
  if (!queenEntry) {
    return 0;
  }

  const queenSquare = squares.get(queenEntry.id);
  if (!queenSquare) {
    return 0;
  }

  const queenStart =
    color === 'w' ? { file: 3, rank: 0 } : { file: 3, rank: 7 };
  const queenMoved =
    queenEntry.hasMoved ||
    queenSquare.file !== queenStart.file ||
    queenSquare.rank !== queenStart.rank;

  if (!queenMoved) {
    return 0;
  }

  const developedMinors = countDevelopedMinors(state, squares, color);
  if (developedMinors >= 2) {
    return 0;
  }

  const fade =
    (OPENING_FULLMOVE_LIMIT - state.fullmoveNumber + 1) / OPENING_FULLMOVE_LIMIT;
  return -EARLY_QUEEN_PENALTY * Math.max(0, fade);
}

function pieceSquareScore(
  state: GameState,
  squares: Map<number, { file: number; rank: number }>,
  color: Color
): number {
  let score = 0;
  for (const piece of state.pieces.values()) {
    if (piece.color !== color) {
      continue;
    }
    if (piece.type !== 'knight' && piece.type !== 'bishop') {
      continue;
    }
    const square = squares.get(piece.id);
    if (!square) {
      continue;
    }
    const index =
      color === 'w'
        ? square.rank * 8 + square.file
        : (7 - square.rank) * 8 + square.file;
    const table = piece.type === 'knight' ? KNIGHT_PST : BISHOP_PST;
    score += table[index];
  }
  return score;
}

function countDevelopedMinors(
  state: GameState,
  squares: Map<number, { file: number; rank: number }>,
  color: Color
): number {
  const startSquares =
    color === 'w'
      ? {
          bishop: [
            { file: 2, rank: 0 },
            { file: 5, rank: 0 }
          ],
          knight: [
            { file: 1, rank: 0 },
            { file: 6, rank: 0 }
          ]
        }
      : {
          bishop: [
            { file: 2, rank: 7 },
            { file: 5, rank: 7 }
          ],
          knight: [
            { file: 1, rank: 7 },
            { file: 6, rank: 7 }
          ]
        };

  let developed = 0;
  for (const piece of state.pieces.values()) {
    if (piece.color !== color) {
      continue;
    }
    if (piece.type !== 'bishop' && piece.type !== 'knight') {
      continue;
    }
    const square = squares.get(piece.id);
    if (!square) {
      continue;
    }
    const starts = startSquares[piece.type];
    const isStart = starts.some(
      (start) => start.file === square.file && start.rank === square.rank
    );
    if (piece.hasMoved || !isStart) {
      developed += 1;
    }
  }
  return developed;
}

function hasPawnOnFile(
  state: GameState,
  squares: Map<number, { file: number; rank: number }>,
  color: Color,
  file: number
): boolean {
  for (const piece of state.pieces.values()) {
    if (piece.color !== color || piece.type !== 'pawn') {
      continue;
    }
    const square = squares.get(piece.id);
    if (square && square.file === file) {
      return true;
    }
  }
  return false;
}
