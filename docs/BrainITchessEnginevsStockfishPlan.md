# BrainIT Chess Engine vs Stockfish Benchmark Plan

Purpose
- Measure current playing strength against Stockfish without changing our engine.
- Produce repeatable results: Elo delta with confidence and a short internal report.

Constraints
- Treat our engine as a black box (no tuning, no depth/heuristic changes).
- Use existing difficulty modes as-is (Easy/Medium/Hard).
- Stockfish can be configured for fairness (time, depth, threads, hash).
- Same hardware for both engines during a run.

Best-Practice Methodology
- Match format:
  - Double round per opening (swap colors).
  - 12-24 opening seeds (4-8 ply).
  - Cap total ply (200-240) -> adjudicate draw.
- Time control:
  - Prefer fixed depth for Stockfish to mirror our fixed-depth engine.
  - Alternative: fixed movetime if we want wall-clock parity.
- Draw rules:
  - Enforce threefold repetition, 50-move, insufficient material.
  - Optional: adjudicate draw if both sides are > +7.0 or < -7.0 for N plies
    (only if we add a Stockfish eval hook for adjudication).
- Bias control:
  - Stockfish: Threads=1, Hash=64, Ponder=false.
  - Fixed RNG seed for our engine when possible.
  - Same openings and time settings for both colors.

Implementation Plan (Node-based Harness)
- Runner (TypeScript) to:
  - Apply opening moves to GameState.
  - Alternate engines per ply.
  - Track time per move and total game time.
  - Persist game PGNs and summary stats (JSON/CSV).
- Engine adapters:
  - Our engine adapter: call chooseMove(state, { difficulty }).
  - Stockfish adapter: UCI driver over local binary or wasm.
- Logging:
  - PGN per game.
  - JSON summary: W/D/L, move times, result, opening id, errors.
  - CSV summary for quick plotting.

Rating Estimation
- Score S = (W + 0.5 * D) / N
- Elo delta = 400 * log10(S / (1 - S))
- CI:
  - Use Wilson interval for S, then convert to Elo.
  - Report: Elo delta +/- CI at 95% confidence.
- Stability:
  - 400-800 games recommended for +/-50 Elo, depending on draw rate.

Deterministic Tests (Harness)
- plays legal moves only
- completes N games without crash
- outputs valid PGN
- respects time control within tolerance

Quick-and-Dirty Comparison (Directional Only)
- 100-300 games total.
- Fixed movetime for both engines (50/100/250 ms).
- Stockfish at low depth or low nodes to keep parity.
- Openings: 10-20 fixed seeds.
- Output:
  - W/D/L and Elo delta (high variance).
  - Average move time and obvious blunders (e.g., missed mate-in-1).

Quick-run script (batch of 10)
- Script: `scripts/bench/quickVsStockfish.ts`
- Report: `docs/BrainITVsStockfishReport.md`
- Run one batch (default 10 games), then re-run for the next batch:
  - `npm run bench:quick -- --stockfish "C:\path\to\stockfish.exe" --batch 10 --movetime 100 --mode max`
- Results are appended to the report between `<!-- REPORT:START -->` and `<!-- REPORT:END -->`.

Sample Summary Template
Run:
  Date:
  Engines: BrainIT (Hard) vs Stockfish (depth=6, Threads=1, Hash=64)
  Games: 200 (100 openings x 2 colors)
Results:
  W / D / L:
  Score:
  Elo delta (95% CI):
Notes:
  Avg move time (our engine):
  Avg move time (Stockfish):
  Crash count:

Decisions Needed
- Stockfish backend: local binary path vs wasm.
- Preferred time control: depth vs movetime.
- OK to add dev dependency for runner (e.g., tsx).
