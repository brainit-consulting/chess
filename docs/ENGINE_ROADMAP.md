# Engine Roadmap (Hard + Max Strength)

This is a phased plan to increase playing strength for Hard and Max while preserving the current time caps (Hard ~800ms, Max 10s with Force Move Now). The plan prioritizes Elo gain per risk/perf cost and keeps Max strictly stronger than Hard.

## Constraints

- Do not change time budgets: Hard ~800ms; Max 10s.
- Max must remain stronger than Hard.
- Repetition rate must be reduced without altering time budgets.
- Each phase should be measurable with existing benchmarks (self-play + Stockfish).

## Phase 0 - Baseline discipline (no engine changes)

- Change list
  - Keep using the self-play harness with `--swap` and `--fenSuite`.
  - Track decisiveness metrics (captures/pawn moves), repetition rate, mate rate.
- Expected benefit
  - Clear baseline to validate later changes.
- Risks / failure modes
  - None (no engine changes).
- Validation plan
  - Self-play: W/D/L, repetition rate, mate rate, avg plies, decisiveness.
  - Stockfish quick bench: `scripts/bench/quickVsStockfish.ts`.
- Rollback plan
  - Not applicable.

## Phase 1 - Safe anti-draw policy (targets repetition)

Goal: Reduce early threefolds without changing time caps.

- Change list (files)
  - `src/ai/search.ts`
    - In `scoreRootMoves` / `findBestMove`, add a stronger repetition penalty when the engine is ahead (material or eval threshold) and `playForWin` is true.
    - Allow repetition when behind (defensive draw).
  - `src/ai/ai.ts`
    - Expose an optional `repetitionPenalty` scale for Max (stronger than Hard).
  - `src/game.ts`
    - Ensure AI vs AI always passes `playForWin` and recent position keys (already present; keep it on).
- Expected benefit
  - Fewer early threefolds, higher mate rate, better conversion when ahead.
- Risks / failure modes
  - Over-pressing in equal positions; can cause avoidable losses if penalty is too strong.
  - Increased move volatility late in games.
- Validation plan
  - Self-play: drop in repetition rate, increase in mate rate without spike in losses.
  - Track early repetition count and avg repetition ply.
- Rollback plan
  - Feature-flag via option (e.g., penalty scale). Revert to default penalty if loss rate increases.

## Phase 1b - Near repetition penalties + root tie-break (completed)

- Change list (files)
  - `src/ai/search.ts`
    - Add near-repetition vs threefold multipliers and root tie-break away from repeating top moves.
- Results (commit b75cc1a)
  - Self-play (Hard 800 vs Max 3000, swap, fenSuite, seed 3000):
    - Total (Hard perspective): 3-7-0
    - Repetition rate: 60% (down from 80% baseline)
    - Mate rate: 30% (up from 10% baseline)
  - Segment: Hard as White vs Max: 0-5-0, repetition 100%.
  - Segment: Max as White vs Hard: 3-2-0, repetition 20%, mate 60%.
- Takeaway
  - Max conversion improved materially; Hard as White still repeats heavily.

## Phase 1c - Hard-only anti-loop nudge (target Hard repeats)

- Change list (files)
  - `src/ai/search.ts`
    - Add a Hard-only tie-break window expansion when slightly ahead and the best move repeats.
    - Only triggers on near/threefold repeats when a non-repeat move is close in eval.
  - `src/ai/ai.ts`
    - Add `hardRepetitionNudgeScale` (default on for Hard; off for Max/others).
- Expected benefit
  - Reduce early repetition for Hard without weakening Max or changing time caps.
- Risks / failure modes
  - Hard may decline safe draws when slightly ahead; keep window small and gate by eval.
- Validation plan
  - Self-play: same config as Phase 1b; verify lower early repetition while Max remains stronger.
- Rollback plan
  - Set `hardRepetitionNudgeScale` to 0.

## Phase 2 - Evaluation upgrades (low risk, steady Elo)

- Change list (files)
  - `src/ai/evaluate.ts`
    - Add cheap pawn-structure terms: passed pawns, doubled/isolated pawns, connected passers.
    - Add rook activity: open files, 7th-rank bonus.
    - Add bishop pair bonus (small).
    - Tapered evaluation (opening/middlegame/endgame weights) to avoid early-queen penalties in late game.
    - Keep extra, higher-cost terms gated by `maxThinking` to preserve Max advantage.
- Expected benefit
  - Better conversion, fewer tactical blunders in quiet positions, improved endgame play.
- Risks / failure modes
  - Evaluation noise if weights are too large.
  - Possible time hit if terms are too expensive (Hard budget).
- Validation plan
  - Self-play: higher mate rate, fewer "other" draws, better decisiveness.
  - Stockfish quick bench: should not regress.
- Rollback plan
  - Guard new terms with feature flags and tune weights down if regressions appear.

## Phase 3 - Search and ordering improvements (moderate risk)

- Change list (files)
  - `src/ai/search.ts`
    - Enable a small TT for Hard (limited size) to cut blunders while staying within 800ms.
    - Add basic killer/history ordering for Hard, but keep Max with deeper TT and full ordering.
    - Consider light quiescence for Hard at depth 0 for captures only (optional).
  - `src/ai/ai.ts`
    - Separate `maxDepth` and ordering caps for Hard vs Max.
- Expected benefit
  - Higher tactical reliability for Hard, stronger Max conversion with deeper pruning.
- Risks / failure modes
  - Time spikes if TT or ordering grows too large.
  - Reduced variation if ordering becomes too rigid.
- Validation plan
  - Self-play: Hard should improve but Max should remain stronger (W/D/L vs Max).
  - Track average move time and timeouts; ensure Hard stays ~800ms.
- Rollback plan
  - Keep ordering and TT sizes configurable; revert to current maxThinking-only path if needed.

## Phase 4 - Endgame conversion (target late-game draws)

- Change list (files)
  - `src/ai/evaluate.ts`
    - Add king activity in endgames, pawn races, opposition heuristics.
  - Optional: add small KPK lookup (hard-coded or lightweight table).
- Expected benefit
  - Better conversion in pawn endings; lower repetition in simplified positions.
- Risks / failure modes
  - Heuristic bugs can cause blunders in edge cases.
- Validation plan
  - FEN suite focused on endgames; track conversion rate and mate rate.
- Rollback plan
  - Wrap endgame heuristics behind a feature flag; disable if regressions appear.

## Max remains stronger than Hard

To preserve the strength gap:
- Keep max-only features (TT depth, aspiration windows, quiescence, null-move, LMR).
- If adding shared evaluation terms, add extra terms only under `maxThinking`.
- Use larger repetition penalty for Max than Hard in AI-vs-AI play.

## Validation checklist (every phase)

- Self-play (Hard vs Max): W/D/L, repetition rate, mate rate, avg plies, decisiveness metrics.
- Stockfish quick bench: verify no regression in baseline.
- FEN/tactics suite: measure tactical stability and conversion.
- Time budget guardrails: Hard avg move time stays near 800ms; Max under 10s with Force Move Now.
