import { describe, expect, it } from 'vitest';
import { GameHistory } from '../gameHistory';
import { applyMove, createInitialState, getLegalMovesForSquare } from '../../rules';

const sq = (file: number, rank: number) => ({ file, rank });

describe('GameHistory', () => {
  it('groups moves into numbered rows', () => {
    const history = new GameHistory();
    const state = createInitialState();

    const whiteMoves = getLegalMovesForSquare(state, sq(4, 1));
    const e4 = whiteMoves.find((move) => move.to.file === 4 && move.to.rank === 3);
    if (!e4) {
      throw new Error('Expected e4 to be available.');
    }
    history.addMove(state, e4);
    applyMove(state, e4);

    const blackMoves = getLegalMovesForSquare(state, sq(4, 6));
    const e5 = blackMoves.find((move) => move.to.file === 4 && move.to.rank === 4);
    if (!e5) {
      throw new Error('Expected e5 to be available.');
    }
    history.addMove(state, e5);

    const rows = history.getRows();
    expect(rows.length).toBe(1);
    expect(rows[0].moveNumber).toBe(1);
    expect(rows[0].white).toBe('e4');
    expect(rows[0].black).toBe('e5');
  });
});
