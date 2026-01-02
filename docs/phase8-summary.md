# Phase 8 Summary (NNUE + Defensive Consistency)

## A) What we built
- NNUE scaffolding (feature encoder + accumulator + weight loader) with hybrid eval and default `nnueMix = 0.0` (Max-only).
- Defensive search tweaks:
  - 8.2: micro extension for in-check + forced recapture (depth >= 2, within caps).
  - 8.3: recapture-first ordering bump.
- Stockfish annotation pipeline + mistake mining.
- Dataset emitter + chunk runner (streaming outputs).
- NNUE training script + v2 training process.
- Activation wiring fixes (nnueMix threaded through alphaBeta/quiescence; worker weight loading fixed).

## B) Key decisions and results
- nnueMix 0.10 (Max-only) is safe and improves survival (later collapse).
- nnueMix 0.15 is harmful (earlier collapse); rejected.
- NNUE remains Max-only for now; Hard stays classical.

## C) Bench + analysis snapshots
- Baseline (nnueMix 0.0, 12 games): avg plies 34.33, timeouts 5/203 (~2.46%), mates 12/12.
- NNUE mix 0.10 (24 games): avg plies 36.83, timeouts 9/436 (~2.1%), mates 24/24.
- Annotation (mix 0.10 vs baseline): first<=-500cp median 8 vs 7; mate median 34.5 vs 31.5.
- NNUE mix 0.15: avg plies 31.67, mate median 28.5 (worse) -> rejected.

## D) Next steps (Phase 9 draft ideas)
- Reduce timeout rate (<1%) before expanding NNUE to Hard.
- Expand training set for early stability (opening + middlegame emphasis).
- Add a king-safety focused sampling bucket.
- Re-run dataset emission for early chunks to include timeout summaries so more clean rows qualify.
