# Phase 8 Plan: Scorpion Chess Engine

## Overview
Phase 8 focuses on elevating Scorpion’s strength and consistency by fully integrating an NNUE as the primary evaluation, while refining the engine’s strategic playstyle. This phase emphasizes defensive solidity—minimizing tactical blunders and material losses—and deeper long-term planning aligned with classical chess principles. We’ll leverage high-quality game data (PGNs from Scorpion vs. Stockfish matches and GM-level games) to guide training and adjustments.

---

## Milestone 1: Full NNUE Integration as Main Evaluation
**Objective:** Make NNUE the engine’s primary evaluation (leaf eval + search guidance).

### Implementation steps
- **Embed NNUE network:** Implement a standard NNUE-style feature encoder (piece-square feature indices; side-to-move handling; king-dependent feature sets if used).
- **Incremental updates:** Use accumulator/feature-delta updates on make/unmake so eval is fast and stable. Optimize with SIMD where possible.
- **Training & calibration:** Start with a pretrained network (if available), then fine-tune using:
  - Stockfish high-depth evaluations (teacher/distillation labels)
  - Scorpion self-play (to reduce weird preferences / align with your search)
  - A curated set of GM positions for positional coverage
- **Integrate into search:** Ensure both alpha-beta and any MCTS components call NNUE consistently. Remove or minimize legacy handcrafted eval to avoid conflicting signals (or keep a small safety layer only for edge cases while transitioning).
- **Validation:** Regression test tactical suites + positional suites; ensure no major eval regressions (pawn structure, king safety, endgames).

---

## Milestone 2: Defensive Play (Blunder Reduction & Material Preservation)
**Objective:** Reduce “stupid moves”: hanging pieces, missing tactics, unnecessary sacrifices, and drifting into losing endgames.

### Implementation ideas
- **Critical-position extensions:** Extend search depth in checks, forced recaptures, and “only move” defense scenarios.
- **Tactical blunder verification:** If a candidate move’s eval drops sharply after deeper search, trigger a verification re-search (or higher quiescence / deeper verification line).
- **LMR & pruning tuning:** Reduce pruning aggressiveness in tactically volatile positions (especially early plies). Keep full-depth on more candidate defenses.
- **Safer tie-breaks:** When evals are close, prefer moves that:
  - keep material safe
  - improve king safety
  - reduce opponent forcing lines
- **Contempt/draw bias:** Use a mild safety-oriented bias (careful: don’t suppress winning chances).

### Expected outcome
- Lower blunder rate, higher draw rate vs. stronger engines, fewer “collapse” losses.

---

## Milestone 3: Deeper Long-Term Positional Planning
**Objective:** Improve pawn-structure understanding, king safety awareness, piece coordination, and endgame steering.

### Implementation ideas
- **NNUE feature/training emphasis:** Ensure training data includes many slow positional games, endgames, and typical strategic imbalances.
- **Hybrid safety terms (optional):** Temporarily add small handcrafted nudges for key positional truths while NNUE training catches up (e.g., king safety, passed pawns).
- **Quiet-position depth strategy:** In calm positions with stable evals, allow slightly deeper search or better time allocation to find maneuvering plans.
- **Positional test suites:** Add targeted positions:
  - fortress/hold positions
  - good knight vs bad bishop
  - minority attack structures
  - “choose the right pawn break” scenarios

---

## Milestone 4: Learn from Stockfish + GM PGNs (Data-Driven Improvement)
**Objective:** Use game data to find patterns in Scorpion’s mistakes and feed that back into training + search tuning.

### Practical pipeline
1. **Annotate games:** Run Stockfish at high depth on Scorpion’s PGNs and produce:
   - eval before/after each move
   - swing detection (blunder/mistake thresholds)
   - tactical motif tagging (if possible)
2. **Mine recurring failure types:**
   - hanging pieces / missed tactics
   - king safety errors
   - poor endgame transitions
   - overpushing pawns / creating long-term weaknesses
3. **Build targeted training sets:**
   - “mistake positions” labeled by Stockfish eval
   - GM positional samples labeled by Stockfish eval
   - endgame samples labeled by tablebase where applicable
4. **NNUE fine-tuning cycle:** Retrain, validate, and iterate.
5. **Search adjustments from insights:** Tune pruning, extensions, and time management where the data shows repeated failure.

---

## Milestone 5: Benchmarking (Metrics That Prove You’re Improving)
**Objective:** Use a consistent, automated benchmark suite so Phase 8 changes show measurable progress.

### Core metrics (recommended)
- **Elo / SPRT results:** Main headline metric. Run controlled matches vs. a fixed baseline and vs. Stockfish at fixed TC.
- **Average Centipawn Loss (ACPL):** Lower is better. Compute from Stockfish annotations.
- **Blunder rate:** Count moves with eval swing worse than a chosen threshold (e.g., -100cp, -200cp). Track “severe blunders” separately.
- **Draw ratio vs. stronger engines:** Especially important for the defensive goal.
- **Loss-type breakdown:** % losses by:
  - tactical collapse (large eval swing)
  - slow squeeze (gradual decline)
  - endgame conversion failure
- **Node efficiency:** NPS + effective depth; ensure NNUE doesn’t kill throughput. Track strength per node (Elo at fixed nodes/move).
- **Endgame conversion rate:** From winning tablebase-adjacent positions and typical technical endgames.

### Benchmark structure
- **Suite A (tactical):** Puzzle-like positions + tactical test suites
- **Suite B (positional):** Quiet maneuver positions and imbalance positions
- **Suite C (endgames):** Tablebase + near-tablebase + “convert/hold” set
- **Suite D (match play):** 200–1000 game matches vs baseline and vs Stockfish

---

## Deliverables for Phase 8 (What to ask Codex to implement + test)
1. NNUE fully integrated as the default evaluation with incremental accumulator updates.
2. A PGN annotation + mistake mining tool that outputs:
   - ACPL, blunders, swing list, failure patterns
3. Defensive search safeguards:
   - critical extensions
   - verification re-search on suspicious moves
   - safer pruning defaults in sharp positions
4. Benchmark harness + standardized run IDs and outputs for tracking progress over time.

---

## Notes / Suggested First Iteration Order
1. NNUE integration + speed/validity (don’t proceed until stable).
2. Add blunder verification + check/critical extensions.
3. Build the PGN mining pipeline and start generating targeted training sets.
4. Run iterative NNUE fine-tuning + regression/strength tests.
