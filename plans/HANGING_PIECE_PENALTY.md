# Hanging Major Piece Penalty - Execution Record

## Status: REJECTED

## Change Summary
- **Files**: `src/ai/evaluate.ts`, `src/ai/__tests__/ai.test.ts`
- **Roadmap Item**: PRD [!] Critical - hanging major piece penalty
- **Result**: REJECTED and reverted

## Implementation (reverted)
- Penalty for queens/rooks attacked by cheaper pieces
- Used existing legal move lists (zero extra computation)
- `hangingPiecePenalty(state, opponentMoves, color)`: finds cheapest attacker for each major piece
- Penalty formula: `min(MAX, floor((pieceValue - attackerValue) * SCALE))`

## Benchmark Results

### v1 (SCALE=0.05, MAX=40) — runId: hanging-piece-penalty
- Config: Hard 1000ms vs Max 3000ms, 10 games, seed 9003, swap, fenSuite
- W/D/L (Hard perspective): 5-2-3
- Score: 60%
- Mate rate: 80%
- Repetition rate: 20%
- Avg plies: 61.2
- Losses: 3

### v2 (SCALE=0.03, MAX=25) — runId: hanging-piece-penalty-v2
- Config: Hard 1000ms vs Max 3000ms, 10 games, seed 9003, swap, fenSuite
- W/D/L (Hard perspective): 5-5-0
- Score: 75%
- Mate rate: 50%
- Repetition rate: 40%
- Avg plies: 90.5
- Losses: 0

### Baseline (Phase 2c)
- W/D/L: 7-3-0
- Score: 85%
- Mate rate: 70%
- Repetition rate: 30%
- Avg plies: 72.4
- Losses: 0

## Comparison

| Metric | Baseline | v1 (0.05/40) | v2 (0.03/25) |
|--------|----------|-------------|-------------|
| Score % | 85% | 60% | 75% |
| Mate rate | 70% | 80% | 50% |
| Rep rate | 30% | 20% | 40% |
| Avg plies | 72.4 | 61.2 | 90.5 |
| Losses | 0 | 3 | 0 |

## Rejection Rationale

1. **v1 too aggressive**: 3 losses (up from 0), score dropped 25 percentage points
2. **v2 too passive**: No losses but score still down 10pp, mate rate halved, rep rate up 10pp, games 25% longer
3. **Root cause**: Static hanging piece detection without SEE (Static Exchange Evaluation) cannot distinguish truly hanging pieces from well-defended ones in normal positions
4. **Effect**: Makes engine avoid natural centralizing moves for fear of attack, causing passive play
5. **Prerequisite**: Needs SEE to be effective — a much larger project (Phase 7+ territory)

## Lessons Learned
- Tactical information in the eval can conflict with what the search tree already handles
- Hanging piece detection needs defense-awareness (SEE) to avoid penalizing well-defended pieces
- Conservative tuning (v2) reduced losses but shifted the problem from aggression to passivity
