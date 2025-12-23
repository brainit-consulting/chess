import { Color, GameState, Piece, PieceType } from './rules';

export type ScoreState = {
  w: number;
  b: number;
};

const PIECE_POINTS: Record<PieceType, number> = {
  pawn: 1,
  knight: 3,
  bishop: 3,
  rook: 5,
  queen: 9,
  king: 0
};

export class GameStats {
  private previousPieces = new Map<number, Piece>();
  private scores: ScoreState = { w: 0, b: 0 };

  reset(state: GameState): void {
    this.previousPieces = clonePieces(state.pieces);
    this.scores = { w: 0, b: 0 };
  }

  updateAfterMove(state: GameState, capturingColor: Color): void {
    const missing: Piece[] = [];
    for (const [id, piece] of this.previousPieces) {
      if (!state.pieces.has(id)) {
        missing.push(piece);
      }
    }

    if (missing.length > 1) {
      console.warn('Unexpected multiple pieces captured in one move.', missing);
    }

    const total = missing.reduce((sum, piece) => sum + PIECE_POINTS[piece.type], 0);
    if (total > 0) {
      this.scores[capturingColor] += total;
    }

    this.previousPieces = clonePieces(state.pieces);
  }

  getScores(): ScoreState {
    return { ...this.scores };
  }
}

function clonePieces(pieces: Map<number, Piece>): Map<number, Piece> {
  const clone = new Map<number, Piece>();
  for (const [id, piece] of pieces) {
    clone.set(id, { ...piece });
  }
  return clone;
}
