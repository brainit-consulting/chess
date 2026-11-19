import { describe, expect, it } from 'vitest';
import { findBestMoveTimed, type SearchInstrumentation } from '../search';
import { applyMove, createInitialState, getAllLegalMoves, GameState } from '../../rules';

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function middlegame(seed: number, plies: number): GameState {
  const rng = seeded(seed);
  let state = createInitialState();
  for (let i = 0; i < plies; i += 1) {
    const moves = getAllLegalMoves(state, state.activeColor);
    if (!moves.length) break;
    state = applyMove(state, moves[Math.floor(rng() * moves.length)]);
  }
  return state;
}

// Reproduces issue #7: when the Max time budget expires before depth 1 finishes,
// findBestMoveTimed falls back to an unbounded depth-1 search and overruns the budget.
describe('Max timed search budget', () => {
  it('returns within the budget when depth 1 cannot finish', () => {
    const budget = 100; // effective deadline = budget - 60ms buffer
    const overruns: string[] = [];
    for (let seed = 1; seed <= 8; seed += 1) {
      const state = middlegame(seed, 24);
      const instrumentation = {} as SearchInstrumentation;
      const t0 = performance.now();
      const move = findBestMoveTimed(state, state.activeColor, {
        maxDepth: 7,
        maxTimeMs: budget,
        rng: seeded(seed),
        maxThinking: true,
        instrumentation
      });
      const elapsed = performance.now() - t0;
      expect(move).not.toBeNull();
      if (elapsed > budget + 50) {
        overruns.push(`seed ${seed}: ${elapsed.toFixed(0)}ms fallbackUsed=${instrumentation.fallbackUsed}`);
      }
    }
    expect(overruns).toEqual([]);
  }, 60000);
});
