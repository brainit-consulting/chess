import { Color, GameState, PieceType, getAllLegalMoves, isInCheck } from '../rules';

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

export function evaluateState(state: GameState, perspective: Color): number {
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

  const scoreForWhite = material + mobility + checkScore;
  return perspective === 'w' ? scoreForWhite : -scoreForWhite;
}
