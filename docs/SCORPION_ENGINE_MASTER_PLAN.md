# Scorpion Engine Master Plan

This document defines a 3-track plan for ScorpionHeart (Stockfish-based strength), ScorpionCore (TypeScript engine), and NNUE self-training. It is a planning and reporting guide only.

## 1) Vision & non-goals

- Vision: deliver strong, reliable play quickly via ScorpionHeart while steadily improving ScorpionCore to reach native strength.
- Vision: keep benchmarks transparent and separated by track.
- Non-goal: claiming ScorpionCore strength from ScorpionHeart results.
- Non-goal: changing UI/UX behavior when switching engines (must feel identical).

## 2) Glossary

- ScorpionHeart: Stockfish-based UCI engine bundled and renamed as ScorpionHeart.exe.
- ScorpionCore: the in-repo TypeScript engine (rules + search + eval).
- Harness: benchmark runner (selfplay or vs Stockfish).
- runId: a unique identifier for a benchmark run folder/report block.
- checkpoint: a named stop point with results, notes, and a user decision.

## 3) Architecture proposal (IEngine abstraction)

Interface:
- IEngine: startMove(state, options) -> bestMove + metadata

Implementations:
- UciProcessEngine (ScorpionHeart.exe)
- TsSearchEngine (ScorpionCore)

ASCII outline:

UI/Game -> IEngine -> [UciProcessEngine | TsSearchEngine]
          |               |
          |               +-- Stockfish-based ScorpionHeart.exe
          |
          +-- Benchmark Harness (Selfplay / vs Stockfish)

## 4) Behavior parity checklist

- Move legality (same rules and checks).
- Clock handling (respect maxTimeMs and Force Move Now).
- Stop/quit behavior (clean worker/process shutdown).
- Analysis lines (PV formatting and partial lines).
- Draws: repetition, 50-move, stalemate, insufficient material.
- Resign behavior (if used, same thresholds).
- Deterministic seeding (when requested).
- Error handling (never return "no move").

## 5) Benchmarking + Elo reporting spec

RunId conventions (examples):
- Heart: heart-sf500-b25-YYYYMMDD-HHMM
- Core: core-sf500-b25-YYYYMMDD-HHMM
- NNUE: nnue-v1-mix10-sf500-b25-YYYYMMDD-HHMM

Match sizes (minimums):
- Quick check: 20 games (10 openings x 2 colors).
- Confidence: 50+ games (25 openings x 2 colors).

Standard metrics:
- W/D/L
- avg plies
- repetition %
- mate %
- timeouts
- avg think ms

Regression gates:
- timeout rate must not increase materially.
- avg plies must not collapse vs prior baseline.
- W/D/L must not regress beyond noise for equal settings.

Elo estimate (match-based, simple):
- Score S = (W + 0.5 * D) / N
- Elo delta = 400 * log10(S / (1 - S))

Run folder artifacts:
- summary.json (machine-readable rollup)
- report.md (human summary block)

Labeling rule (hard requirement):
- Every report must explicitly label results as HEART or CORE.
- Elo estimates must never be mixed across modes.

## 6) Milestones (M1..M5)

M1: Heart integration baseline
- Heart: UciProcessEngine wired, stable stop/quit, time controls honored.
- Core: no changes required.
- NNUE: no activation.
- Done when: Heart vs Stockfish harness works with stable timeouts.

M2: Core parity baseline
- Heart: unchanged.
- Core: benchmarked against Stockfish with stable results.
- NNUE: scaffolding only.
- Done when: Core runId baseline recorded with consistent metrics.

M3: NNUE pipeline bootstrapped
- Heart: unchanged.
- Core: unchanged.
- NNUE: annotation + dataset + training pipeline produces a non-zero weight file.
- Done when: training report and weights exist (unactivated).

M4: Controlled NNUE activation (Max-only)
- Heart: unchanged.
- Core: unchanged.
- NNUE: mix enabled in Max only at a small value.
- Done when: mix run improves survival without timeout regression.

M5: Core-first strength improvements
- Heart: still available as strong default.
- Core: search/eval improvements tracked and benchmarked.
- NNUE: expanded training set and staged mixes.
- Done when: Core benchmarks show consistent gains across checkpoints.

## 7) Branching & tagging conventions

- Long-lived branches:
  - track/heart
  - track/core
  - track/nnue
- Short-lived branches:
  - feat/<track>-<topic> (example: feat/heart-uci-adapter)
- main must remain releasable.
- Merge milestones from track/* into main only when “done when” criteria are met.
- Tagging:
  - vX.Y.Z for releases
  - cp-<track>-YYYYMMDD-HHMM for stop-point checkpoints

## 8) Licensing & compliance

- ScorpionHeart is Stockfish-based and requires GPL compliance for any distribution.
- Distributions must include proper attribution and required license artifacts.
- This is a planning-only requirement; implementation details are tracked per release.

## 9) 60-minute stop point protocol

At each stop point, produce:
- Commit message pattern: "phaseX: checkpoint <runId> (summary)".
- Benchmark subset: quick 20-game run or 1-2 rungs.
- Report format: add a block with runId, config, W/D/L, avg plies, timeouts.
- Next-actions list: 2-3 concrete choices.
- Stop and wait for user direction after each stop point.
