import { Color, GameState, Move } from '../rules';
import { buildSan } from '../pgn/pgn';

export type HistoryMove = {
  moveNumber: number;
  color: Color;
  san: string;
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
    const san = buildSan(state, move);
    const record: HistoryMove = {
      moveNumber: state.fullmoveNumber,
      color: state.activeColor,
      san
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
        rows.push({ moveNumber: move.moveNumber, white: move.san });
        continue;
      }
      const last = rows[rows.length - 1];
      if (last && last.moveNumber === move.moveNumber && !last.black) {
        last.black = move.san;
      } else {
        rows.push({ moveNumber: move.moveNumber, black: move.san });
      }
    }
    return rows;
  }
}
