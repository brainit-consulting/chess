# Phase 2c: Tapered Evaluation - Execution Record

## Status: ACCEPTED

## Change Summary
- **Commit**: ff4050e
- **Files**: `src/ai/evaluate.ts`, `src/ai/__tests__/ai.test.ts`
- **Roadmap Phase**: 2c

## Implementation
- Material-based game phase: Q=4, R=2, B=1, N=1 (max phase 24)
- `calculateGamePhase(state)`: computes phase from remaining material
- `taper(opening, endgame, phase)`: interpolates between weights
- Tapered terms (opening → endgame):
  - Doubled pawn penalty: 12 → 20
  - Isolated pawn penalty: 15 → 25
  - Passed pawn base bonus: 20 → 35
  - Passed pawn rank bonus: 10 → 15 per rank
  - Connected passer bonus: 15 → 25
  - Connected passer rank bonus: 5 → 8 per rank
  - Rook on 7th bonus: 20 → 30
- King safety terms remain move-number-based (phaseFactor preserved)
- All tapered terms apply to ALL difficulty levels

## Test Results
- 140 tests passed (134 existing + 6 new)
- Build clean (no new TypeScript errors)

## Benchmark Results (runId: phase2c-tapered-eval)
- Config: Hard 1000ms vs Max 3000ms, 10 games, seed 9002, swap, fenSuite
- W/D/L (Hard perspective): 7-3-0
- Score: 85%
- Mate rate: 70%
- Repetition rate: 30%
- Avg plies: 72.4
- Losses: 0
- Early repetitions: 0

## Cumulative Phase 2 Progression

| Metric | Pre-Phase-2 | Phase 2a | Phase 2b | Phase 2c |
|--------|-------------|----------|----------|----------|
| Score % | ~50% | 65% | 80% | 85% |
| Mate rate | 25% | 50% | 60% | 70% |
| Rep rate | 75% | 30% | 20% | 30% |
| Avg plies | 92.5 | 103.3 | 95.8 | 72.4 |
| Losses | ~5 | 1 | 0 | 0 |

## Decision
ACCEPTED - Score 85%, mate rate 70%, zero losses, dramatically faster conversion (72.4 plies). Phase 2 evaluation upgrades complete.
