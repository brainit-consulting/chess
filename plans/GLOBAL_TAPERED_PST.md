# Phase 2d: Tapered Piece-Square Tables - Execution Record

## Status: ACCEPTED (v3) — Max-only tapered PSTs

## Change Summary
- **Files**: `src/ai/evaluate.ts`
- **Roadmap Item**: [x] Tapered piece-square tables (opening/endgame)
- **Result**: v1 REJECTED, v2 REJECTED, v3 ACCEPTED

## What v3 Does
- Renamed `KNIGHT_PST` → `KNIGHT_PST_OPENING`, `BISHOP_PST` → `BISHOP_PST_OPENING`
- Added `KNIGHT_PST_ENDGAME` and `BISHOP_PST_ENDGAME` arrays
- Updated `pieceSquareScore()` to use `taper()` for game-phase-blended values
- Changed function signature: `squares` → `context` (for access to `gamePhase`)
- **Scope**: Max-only (stays in `evaluateMaxThinking`). Hard mode is completely untouched.

### Endgame PST Values
- Knight endgame: stronger centralization (max 25cp vs 20cp opening), less corner penalty
- Bishop endgame: more centralized (max 15cp vs 10cp opening), symmetric

## Benchmark Results (all seed 9006)

### v3 vs Control (apples-to-apples comparison)
| Metric | Control (baseline) | v3 (Max tapered) | Delta |
|--------|-------------------|-------------------|-------|
| Score % | 60% | 70% | **+10pp** |
| W/D/L | 3-6-1 | 4-6-0 | +1W, -1L |
| Mate rate | 40% | 40% | 0 |
| Rep rate | 60% | 50% | -10pp |
| Avg plies | 108.2 | 99.8 | -8.4 |
| Losses | 1 | 0 | -1 |

### Rejected Variants

#### v1 (all PSTs global, all difficulty levels) — seed 9004
- W/D/L: 4-6-0 | Score: 70% | Mate: 40% | Rep: 60%
- Rejected: Moving PSTs to all levels closes Hard-Max gap

#### v2 (king endgame centralization all levels + Max endgame PSTs) — seed 9005
- W/D/L: 2-8-0 | Score: 60% | Mate: 20% | Rep: 60%
- Rejected: King centralization helps both sides equally, Max PSTs widen disadvantage

## Key Lessons
1. **Seed variance is significant** — the original baseline (85%) was a favorable seed; same code with seed 9006 scored only 60%. Control experiments are essential.
2. **Max-only changes are safest** — Hard is untouched, so only Max's play changes
3. **Tapered PSTs give correct piece placement** — knights/bishops centralize more in endgames, matching chess theory
4. **Global eval changes hurt the benchmark** — any improvement to both sides equally narrows the Hard-Max gap
5. **Always compare apples-to-apples** — same seed for v3 and control isolated the real effect
