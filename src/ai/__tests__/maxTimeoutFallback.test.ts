import { describe, expect, it } from 'vitest';
import { findBestMoveTimed, type SearchInstrumentation } from '../search';
import { addPiece, applyMove, createEmptyState, createInitialState, getAllLegalMoves, GameState } from '../../rules';

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
    // Warm up so JIT cost on a cold CI runner does not count against the budget.
    findBestMoveTimed(middlegame(9, 24), 'w', { maxDepth: 2, maxTimeMs: 100, rng: seeded(9), maxThinking: true });
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
      if (elapsed > budget + 200) {
        overruns.push(`seed ${seed}: ${elapsed.toFixed(0)}ms fallbackUsed=${instrumentation.fallbackUsed}`);
      }
    }
    expect(overruns).toEqual([]);
  }, 60000);
});

function isLegal(state: GameState, move: { from: unknown; to: unknown } | null): boolean {
  if (!move) return false;
  return getAllLegalMoves(state, state.activeColor).some(
    (m) => JSON.stringify(m.from) === JSON.stringify(move.from) && JSON.stringify(m.to) === JSON.stringify(move.to)
  );
}

describe('Max stop polling and fallback legality', () => {
  it('uses the fallback and still returns a legal move when the clock expires immediately', () => {
    for (const withInstrumentation of [false, true]) {
      for (let seed = 1; seed <= 4; seed += 1) {
        const state = middlegame(seed, 24);
        let reads = 0;
        // Fake clock: first read is the start, every later read is far past the deadline.
        const now = () => (reads++ === 0 ? 0 : 1_000_000);
        const instrumentation = withInstrumentation ? ({} as SearchInstrumentation) : undefined;
        const move = findBestMoveTimed(state, state.activeColor, {
          maxDepth: 7,
          maxTimeMs: 1000,
          rng: seeded(seed),
          maxThinking: true,
          now,
          instrumentation
        });
        expect(isLegal(state, move)).toBe(true);
        if (instrumentation) {
          expect(instrumentation.fallbackUsed).toBe(true);
        }
      }
    }
  });

  it('returns a legal move within budget on heavy positions with and without instrumentation', () => {
    const budget = 100;
    for (const withInstrumentation of [false, true]) {
      for (let seed = 1; seed <= 4; seed += 1) {
        const state = middlegame(seed, 24);
        const t0 = performance.now();
        const move = findBestMoveTimed(state, state.activeColor, {
          maxDepth: 7,
          maxTimeMs: budget,
          rng: seeded(seed),
          maxThinking: true,
          instrumentation: withInstrumentation ? ({} as SearchInstrumentation) : undefined
        });
        expect(performance.now() - t0).toBeLessThan(budget + 200);
        expect(isLegal(state, move)).toBe(true);
      }
    }
  }, 60000);
});

function sq(name: string) {
  return { file: 'abcdefgh'.indexOf(name[0]), rank: Number(name[1]) - 1 };
}

function build(pieces: Array<[Parameters<typeof addPiece>[1], 'w' | 'b', string]>, active: 'w' | 'b'): GameState {
  const state = createEmptyState();
  for (const [type, color, at] of pieces) addPiece(state, type, color, sq(at), true);
  state.activeColor = active;
  return state;
}

describe('Max fallback edge positions', () => {
  const expiredClock = () => {
    let reads = 0;
    return () => (reads++ === 0 ? 0 : 1_000_000);
  };

  it('returns the only legal move when the budget expires before depth 1', () => {
    // Black Ka8 must capture the unprotected queen on b7.
    const state = build(
      [['king', 'b', 'a8'], ['queen', 'w', 'b7'], ['king', 'w', 'h1']],
      'b'
    );
    expect(getAllLegalMoves(state, 'b')).toHaveLength(1);
    const instrumentation = {} as SearchInstrumentation;
    const move = findBestMoveTimed(state, 'b', {
      maxDepth: 7,
      maxTimeMs: 1000,
      rng: seeded(1),
      maxThinking: true,
      now: expiredClock(),
      instrumentation
    });
    expect(move).toEqual(getAllLegalMoves(state, 'b')[0]);
    expect(instrumentation.fallbackUsed).toBe(true);
  });

  it('returns null for checkmate and stalemate instead of an illegal move', () => {
    const mate = build([['king', 'b', 'a8'], ['queen', 'w', 'b7'], ['king', 'w', 'b6']], 'b');
    const stalemate = build([['king', 'b', 'a8'], ['queen', 'w', 'b6'], ['king', 'w', 'c7']], 'b');
    for (const state of [mate, stalemate]) {
      expect(getAllLegalMoves(state, 'b')).toHaveLength(0);
      expect(
        findBestMoveTimed(state, 'b', {
          maxDepth: 7,
          maxTimeMs: 1000,
          rng: seeded(1),
          maxThinking: true,
          now: expiredClock()
        })
      ).toBeNull();
    }
  });

  it('returns a legal move in a back-rank position on the fallback path', () => {
    const state = build(
      [
        ['king', 'b', 'g8'], ['pawn', 'b', 'f7'], ['pawn', 'b', 'g7'], ['pawn', 'b', 'h7'],
        ['rook', 'w', 'a1'], ['king', 'w', 'g1']
      ],
      'w'
    );
    const move = findBestMoveTimed(state, 'w', {
      maxDepth: 7,
      maxTimeMs: 1000,
      rng: seeded(1),
      maxThinking: true,
      now: expiredClock()
    });
    const legal = getAllLegalMoves(state, 'w');
    expect(legal.some((m) => JSON.stringify(m) === JSON.stringify(move))).toBe(true);
  });
});

// Documents the per-call `stopTicker` finding from issue #7. The loop-level poll in
// alphaBeta/quiescence uses a counter re-created on every call, so its `& 1023` mask is
// effectively unreachable without instrumentation. It does not matter for Max because every
// node entry already calls stopChecker, which reads the clock. This proves that by counting
// clock reads against nodes searched on a deterministic fixed-depth search.
describe('stop polling cadence (issue #7)', () => {
  it('reads the clock at least once per node, with or without instrumentation', () => {
    const state = middlegame(3, 24);
    const run = (instrumented: boolean) => {
      let reads = 0;
      const instrumentation = instrumented ? ({} as SearchInstrumentation) : undefined;
      findBestMoveTimed(state, state.activeColor, {
        maxDepth: 1,
        maxTimeMs: 600_000,
        rng: seeded(3),
        maxThinking: true,
        now: () => {
          reads += 1;
          return 0;
        },
        instrumentation
      });
      return { reads, nodes: instrumentation?.nodes ?? 0 };
    };
    const instrumented = run(true);
    const plain = run(false);
    expect(instrumented.nodes).toBeGreaterThan(0);
    expect(instrumented.reads).toBeGreaterThanOrEqual(instrumented.nodes);
    // Same deterministic search: the non-instrumented path polls just as often.
    expect(Math.abs(plain.reads - instrumented.reads)).toBeLessThanOrEqual(3); // instrumentation reads the clock a few extra times
  });
});
