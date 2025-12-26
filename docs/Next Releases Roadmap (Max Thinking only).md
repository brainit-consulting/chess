# Next Releases Roadmap (Max Thinking only)

Goal: increase Max Thinking strength via search efficiency + tactical safety, without raising time budgets and without changing Easy/Medium/Hard.

Hard rules
- Max-only gating for all changes below.
- One phase per release (do not bundle phases).
- Keep each change behind a small flag where reasonable.
- Add/extend tests for each phase (unit or deterministic probe).
- No time budget or depth cap changes unless explicitly approved later.

========================================================
Release v1.1.44 — Search Efficiency + Tactic Safety (Low risk / High ROI)
========================================================

Phase 3A — Move ordering upgrades (Killer + History)
Impact: High
Risk: Low
Why: Better ordering means deeper effective search, fewer blunders, faster mates.
Status: Completed in v1.1.44.

Implementation
1) Keep TT-best-move-first (already present).
2) Add Killer heuristic:
   - Track 1–2 killer moves per depth (ply) for quiet moves causing beta cutoffs.
3) Add History heuristic:
   - Maintain history score table keyed by (from,to).
   - Increment when a quiet move causes a cutoff; decay periodically.
4) Ordering priority (Max only):
   - TT move
   - Mate/check candidates (existing check bonus can remain)
   - Captures (MVV-LVA)
   - Killer moves
   - History-scored quiet moves
   - Remaining quiet moves

Definition of done
- Tests pass.
- No change to Easy/Medium/Hard outputs.
- Ordering function has deterministic behavior for equal scores (stable tie-breaker).

Tests
- Add a unit test for ordering: given a crafted position, verify TT move ranks first, killer outranks random quiet, etc.
- Run 1 Max vs Max PGN manually and confirm no regressions (opening discipline preserved).

--------------------------------------------------------

Phase 3B - Aspiration Windows (Iterative Deepening)
Impact: Medium-High
Risk: Low-Medium
Why: Speeds alpha-beta by searching a narrower score window around the last iteration's score.
Status: Completed in v1.1.45.

Implementation
- At each iterative deepening depth:
  - Start with window [prevScore - delta, prevScore + delta].
  - If fail-low/high, widen and re-search.
- Keep conservative delta (e.g., 25–50 centipawns equivalent) and widen progressively.

Definition of done
- No crashes or infinite re-search loops.
- Search respects time budget.
- On timeout, returns best fully completed depth.

Tests
- Add a deterministic test that ensures aspiration window retries occur on forced swing positions (fail-high/low).
- Confirm node count/time improves vs baseline on the same fixed FEN.

--------------------------------------------------------

Phase 3C — SEE-lite capture filter (tactical sanity + speed)
Impact: Medium–High
Risk: Medium
Why: Prevent obviously losing captures and reduce branching.

Implementation (lightweight, not full SEE)
- For each capture candidate:
  - Compute material delta of capture.
  - Simulate the simplest recapture sequence (captured value - attacker value, plus immediate recapture by lowest-value defender).
  - Optional: include “hanging queen/rook” immediate loss check.
- If capture is clearly losing beyond a threshold, deprioritize or prune from quiescence/capture lists (Max only).

Definition of done
- Engine stops choosing obviously losing captures in crafted test positions.
- No major tactical regressions (do not prune winning sacs too aggressively).

Tests
- Add 2–3 fixed FEN tests:
  - A poisoned pawn capture that loses queen (should be rejected or heavily deprioritized).
  - A legitimate winning sacrifice (must still be considered).
- Ensure quiescence still finds mates/capture lines.

========================================================
Release v1.1.46 - Deeper Search Tricks (Higher risk; only after v1.1.45 proven)
========================================================

Phase 4A — LMR (Late Move Reductions), conservative
Impact: High
Risk: Medium–High
Prereq: killer/history + aspiration windows must be working well.

Implementation
- After N best moves (e.g., after first 3–4 moves), reduce depth for low-priority quiet moves.
- Only apply when:
  - not in check
  - not tactical (capture/check) move
  - depth >= threshold
- Keep reductions tiny initially (e.g., -1 ply).

Tests
- Regression positions where tactics exist late in move list (ensure not missed).
- Confirm search depth increases on top moves without losing tactical accuracy.

--------------------------------------------------------

Phase 4B — Null-move pruning, very conservative + endgame guards
Impact: High
Risk: High

Implementation safeguards
- Disable in:
  - check
  - low material/endgames (define material threshold)
  - pawn-only-ish zugzwang-prone positions
- Conservative reduction (R=2 or smaller), verify.

Tests
- Zugzwang test FENs (must not incorrectly prune).
- Quiet middlegame FEN showing speed improvement.

========================================================
Optional later (only after above is stable)
========================================================
- Quiescence extensions: promotions first (low risk), then carefully consider further expansion.
- King/queen PST phase tables: only after search improvements, tune eval with care.
- TT aging/bucketing: only if collisions/instability are observed.
- Mate distance pruning: only if a specific mate-search performance issue persists.

========================================================
Manual evaluation protocol after each release
========================================================
After each phase/release, you will run:
- 2–3 Max vs Max games (same time budget)
- 1 Human vs Max game (hints on/off as desired)

Deliverables required per release
- Short summary of changes.
- List of flags/settings.
- New tests/FEN fixtures.
- Confirmation Easy/Medium/Hard unchanged.
