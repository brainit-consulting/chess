import { describe, expect, it } from 'vitest';
import { createInitialState, getPieceAt } from '../index';

const sq = (file: number, rank: number) => ({ file, rank });

describe('initial setup', () => {
  it('places kings and queens on standard squares', () => {
    const state = createInitialState();
    expect(getPieceAt(state, sq(3, 0))).toMatchObject({ type: 'queen', color: 'w' });
    expect(getPieceAt(state, sq(4, 0))).toMatchObject({ type: 'king', color: 'w' });
    expect(getPieceAt(state, sq(3, 7))).toMatchObject({ type: 'queen', color: 'b' });
    expect(getPieceAt(state, sq(4, 7))).toMatchObject({ type: 'king', color: 'b' });
  });

  it('places rooks on a1 and a8', () => {
    const state = createInitialState();
    expect(getPieceAt(state, sq(0, 0))).toMatchObject({ type: 'rook', color: 'w' });
    expect(getPieceAt(state, sq(0, 7))).toMatchObject({ type: 'rook', color: 'b' });
  });
});
