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
- Results (seed 3000 fastcheck)
  - 0-10-0, repetition 100%, mate 0% (ineffective).
- Status
  - Attempted but ineffective; superseded by Phase 3.1 anti-loop constraints.

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
- Results (seed 4000 fastcheck)
  - 0-9-1, repetition 80%, mate 10%.

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
- Results (seed 5000 fastcheck)
  - 0-10-0, repetition 100%, mate 0%.

## Phase 3.1 - Anti-loop root constraints (pending validation)

- Change list (files)
  - `src/ai/search.ts`
    - Root avoidance constraint: if the top move repeats and a non-repeat is within an eval window, choose the best non-repeat when not losing.
    - Two-ply anti-loop penalty on top root moves that quickly return to recent positions.
  - `src/ai/ai.ts`
    - Defaults (Hard vs Max):
      - Avoid window: Hard 20cp, Max 35cp.
      - Two-ply repeat penalty: Hard 18cp, Max 30cp.
      - Draw-hold threshold: -80cp.
      - Top-N for two-ply check: 6.
- Expected benefit
  - Reduce repetition loops without time-cap changes; preserve Max > Hard.
- Risks / failure modes
  - Small eval regressions if the window is too wide; ensure losing side can still repeat.
- Validation plan (local)
  - Fastcheck: `npm run bench:selfplay -- --hardMs 800 --maxMs 3000 --batch 5 --swap --fenSuite --seed 6000 --runId phase3_1-fastcheck`
  - Real cap: `npm run bench:selfplay -- --hardMs 800 --maxMs 10000 --batch 5 --swap --fenSuite --seed 6000 --runId phase3_1-10000ms`
- Results
  - Pending local validation.

## Phase 4 - Search efficiency + ordering (browser-friendly)

- Change list (files)
  - Phase 4.1 (implemented):
    - PVS in alpha-beta for maxThinking (null-window re-search on non-PV moves).
    - Countermove heuristic for quiet moves (Max only).
    - Root contempt bias in play-for-win scoring (Hard 10cp, Max 20cp; draw-hold threshold -80cp).
    - Quiet history ordering strengthened for Max, modest for Hard.
    - Bench diagnostics: root top moves + chosen move reason in self-play meta.
  - Phase 4.1b (implemented):
    - Root repeat-ban policy: prefer non-repeats within a window when not losing (Hard 60cp, Max 100cp).
    - Diagnostics summarizer for self-play move reasoning (bench-only).
  - Phase 4.1c (implemented):
    - Progress bias for quiet development (minor development, castling/king safety, pawn advance).
    - Twofold repulsion multiplier (stronger than generic near-repeat, below threefold).
    - Root ordering deprioritizes quiet repeat moves when not losing.
  - Phase 4.2 (implemented, locked): bounded selective extensions (recapture-first) with check-extension gating.
  - Phase 4.3 (implemented, commit ecbdd1a): defensive repetition awareness, in-check ordering, mate-distance preference.
  - Phase 4.4 (step 1 implemented, commit c37ffcc): check-pressure safety bias for in-check evasions.
  - Phase 4.4.2 (implemented, commit 714a389): minimal check extension (+1 ply when in check).
  - Phase 4.4.2b (implemented, commit 88da25d): cap total extension at +1 (combine check + forcing without suppression).
- Expected benefit
  - Lower node count for the same depth, higher tactical clarity, fewer drawish loops.
- Risks / failure modes
  - Over-pruning can hide tactics; ordering bias can reduce variety.
- Validation plan
  - Self-play: repetition rate, mate rate, avg plies, timing.
  - Stockfish quick bench: no regression.
- Rollback plan
  - Keep changes gated by `maxThinking` first; revert subphase independently.
- Results
  - Phase 4.1 fastcheck (seed 7000, maxMs 3000): 0-10-0, repetition 100%, mate 0%.
  - Phase 4.1b: pending local validation (seed 7000).
  - Phase 4.1c: pending local validation (shuffle-loop focus).
  - Phase 4.2: locked; no further ladder rungs until Phase 4.3 changes land.
  - Phase 4.3: implemented (commit ecbdd1a).

### Phase 4.2 detail (completed and locked)

- Objectives
  - Improve tactical stability and conversion while keeping Hard within ~800ms.
  - Reduce repetition collapse or keep it stable (no regressions vs Phase 4.1 baseline).
  - Preserve Max > Hard strength ordering.
- Changes delivered
  - 4.2A Recapture extension (primary)
    - Add a +1 ply extension for immediate recaptures at the root and inside search.
    - Focus on recapture-first to stabilize tactics without opening full tactical explosions.
  - 4.2B Optional check-extension gating (secondary)
    - Gate the existing check extension so noisy/hanging checks do not inflate depth.
    - Only extend checks that are safe or materially sensible.
- Guardrails / caps
  - Depth gate: extension only when depth > 0 and a small per-line cap is not exceeded.
  - Ply gate: cap total extension plies per line (same style as current forcing-extension caps).
  - Hard-first budget: keep extensions lightweight for Hard; Max can be slightly more permissive.
  - Time-aware: never bypass the existing stop/timeout checks.
- Validation plan
  - Stockfish ladder rungs completed for Hard 800ms vs Stockfish 600/500/400ms (swap + FEN suite).
  - Track repetition rate, mate rate, avg plies, timeouts, and W/D/L.
- Success criteria
  - No increase in Hard timeouts.
  - Mate rate stable or higher; repetition rate stable or lower.
  - No major regression in W/D/L vs Phase 4.1 baseline.
- Out of scope (Phase 4.2)
  - No futility/razoring pruning changes.
  - No evaluation tuning or new eval terms.
  - No 50-move rule or draw-rule changes.

### Phase 4.3 detail (implemented, commit ecbdd1a)

- Objectives
  - Reduced loop resilience in losing positions without weakening defensive draw chances.
  - Improved tactical stability by prioritizing evasions when in check.
  - Prefer faster mates when winning and delay mates when losing.
- Delivered changes
  - 4.3A Perpetual/repetition awareness when losing
    - Repetition penalties and loop penalties are skipped when below the draw-hold threshold.
  - 4.3B In-check move ordering (evasions first)
    - When in check, evasions are ordered ahead of non-evasions.
  - 4.3C Mate-distance preference
    - Mate scoring now prefers shorter mates and delays losses for both Hard and Max.
- Guardrails / caps
  - No benchmark harness changes during Phase 4.3.
  - Preserve Hard ~800ms and Max 10s caps; no extra heavy eval terms.
  - Keep Max stronger than Hard (Max-only enhancements may be added later if needed).
- Validation
  - Unit tests: `npx vitest run --reporter dot` (added checks for in-check ordering, mate-distance preference, and repetition behavior when losing).
  - Stockfish tracking rung (planned): Hard 800ms vs Stockfish 500ms (b25) after Phase 4.3 changes.
  - Stockfish tracking rung (actual baseline): runId `phase4_2-hard800-vs-sf500-b25` (pre-Phase 4.3 reference in `docs/ScorpionChessEngineVsStockfishReport.md`).
- Success criteria
  - No increase in Hard timeouts.
  - Repetition rate stable or lower; mate rate stable or higher.
  - No regression in Hard vs Max ordering.

### Phase 4.4 detail (step 1 implemented, commit c37ffcc)

- Objective
  - Reduce mate losses by improving the ordering of check evasions (capture > block > king move).
- Delivered change (step 1)
  - Added check-pressure safety bias in in-check move ordering:
    - Capture evasions are prioritized ahead of blocks, with king moves last.
    - King moves into attacked squares are penalized to avoid unsafe evasions.
  - Ordering-only change (no evaluation changes, no legality changes).
- Validation
  - Unit tests: deterministic ordering for capture vs block vs king move; king-into-attack penalty.
  - Stockfish tracking rung after Step 1 (planned): Hard 800ms vs Stockfish 500ms (b25).

- Delivered change (step 2, commit 714a389)
  - Minimal check extension (+1 ply) when the side to move is in check.
  - Extension is capped by the forcing extension depth/ply limits and does not stack.
- Validation (step 2)
  - Unit tests: check extension depth added and ply guard respected.
  - Stockfish tracking rung after Step 2 (planned): Hard 800ms vs Stockfish 500ms (b25).

- Delivered change (step 2b, commit 88da25d)
  - Cap total extension at +1 by combining check and forcing extensions (no suppression).
- Validation (step 2b)
  - Unit test for total extension cap with check + forcing.
  - Stockfish tracking rung after Step 2b (planned): Hard 800ms vs Stockfish 500ms (b25).

## Phase 5 - Endgame conversion (target late-game draws)

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
