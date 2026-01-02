# ScorpionChessEngineVsStockfish Benchmark Plan

## Phase 9.2c guardrail confirmation (Hard 1000 vs SF500, b6)

RunId: phase9-regress-hard1000-vs-sf500-b6-seed7000-r7  
- W/D/L: 0-0-12 | Avg plies: 36.7 | Timeouts: 5/217 (2.30%)  
- stopReason: mid_search_deadline=171, pre_iter_gate=40, none=6, external_cancel=0

RunId: phase9-regress-hard1000-vs-sf500-b6-seed7001-r2  
- W/D/L: 0-0-12 | Avg plies: 32.2 | Timeouts: 4/190 (2.11%)  
- stopReason: mid_search_deadline=160, pre_iter_gate=23, none=7, external_cancel=0

Conclusion: hardStop remains dominant and timeout rate is still >2%; guardrail is not yet meeting the <1% target.

Purpose
- Measure current playing strength against Stockfish without changing our engine.
- Produce repeatable results: Elo delta with confidence and a short internal report.

Constraints
- Treat our engine as a black box (no tuning, no depth/heuristic changes).
- Use existing difficulty modes as-is (Easy/Medium/Hard/Max Thinking).
- Stockfish can be configured for fairness (time, depth, threads, hash).
- Same hardware for both engines during a run.

Best-Practice Methodology
- Match format:
  - Double round per opening (swap colors).
  - 12-24 opening seeds (4-8 ply).
  - Cap total ply (200-240) -> adjudicate draw.
- Time control:
  - Prefer fixed movetime for parity (recommended for the current harness).
  - Alternative: fixed depth if you want deterministic depth on Stockfish.
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
  - Our engine adapter: call chooseMove(state, { difficulty, maxTimeMs }).
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

Ladder Runs (Phase Baselines)
- Start at equal times (e.g., Scorpion 1000ms vs Stockfish 1000ms) to validate stability.
- Then step Stockfish down (e.g., 600ms, 400ms, 250ms) until Scorpion starts scoring.
- Use swap + fenSuite for paired colors and consistent openings.
- RunId convention: `phase6-time-hard1000-vs-sf600-b10` = phase, engine time, Stockfish time, batch size.
- `--stockfishMovetime` sets Stockfish time separately; if omitted, Stockfish uses `--movetime`.
- Bench-only timeout tolerance is applied uniformly to both engines to absorb stop latency/jitter.

Quick-run script (batch of 10)
- Script: `scripts/bench/quickVsStockfish.ts`
- Report: `docs/ScorpionChessEngineVsStockfishReport.md`
- Ready-to-paste commands:

```powershell
# Quick sanity: 10 games total (no swap)
npm run bench:quick -- --stockfish "C:\path\to\stockfish.exe" --batch 10 --movetime 200 --mode hard --no-swap --seed 7000 --runId quick-10
```

```powershell
# Balanced colors: 10 games per color (20 total), paired FENs
npm run bench:quick -- --stockfish "C:\path\to\stockfish.exe" --batch 10 --movetime 200 --mode hard --swap --fenSuite --seed 7000 --runId quick-10-swap
```

```powershell
# Small smoke test: 2 games per color (4 total)
npm run bench:quick -- --stockfish "C:\path\to\stockfish.exe" --batch 2 --movetime 100 --mode hard --swap --fenSuite --seed 7000 --runId smoke-2
```

```powershell
# Max mode example: 5 games per color at 3000ms
npm run bench:quick -- --stockfish "C:\path\to\stockfish.exe" --batch 5 --movetime 3000 --mode max --swap --fenSuite --seed 7000 --runId max-3000
```

```powershell
# Ladder rung example: Scorpion 1000ms vs Stockfish 600ms (10 per color)
npm run bench:quick -- --stockfish "C:\path\to\stockfish.exe" --batch 10 --movetime 1000 --stockfishMovetime 600 --mode hard --swap --fenSuite --seed 7000 --runId phase6-time-hard1000-vs-sf600-b10
```

Notes:
- With `--swap` enabled, the run plays `batch * 2` games (paired colors per opening/FEN).
- Use `--outDir` to override output location; default is `scripts/bench/quick-results/run-<runId>/`.
- Use `--reset` if you want to start a fresh series instead of appending to the existing run state.
- Results are appended to the report between `<!-- REPORT:START -->` and `<!-- REPORT:END -->`.

Sample Summary Template
Run:
  Date:
  Engines: Scorpion (Hard) vs Stockfish (depth=6, Threads=1, Hash=64)
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

Current timing notes
- Gameplay Hard uses depth 3 with a UI time cap (~1000ms) for responsiveness.
- Max Thinking uses iterative deepening with a hard 10s cap.
