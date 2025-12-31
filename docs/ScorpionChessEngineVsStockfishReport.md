# ScorpionChessEngineVsStockfish Report (Quick Run)

This report tracks the quick-and-dirty benchmark batches. Each run executes a
fixed number of games (default: 10) and updates the cumulative results here.

How to run a batch (quick bench):

```
npm run bench:quick -- --stockfish "C:\path\to\stockfish.exe" --batch 10 --movetime 200 --mode hard --swap --fenSuite --seed 7000 --runId phase4_2-quick
```

Notes:
- `--batch` is the per-color game count; with `--swap` enabled the run plays `batch * 2` games.
- `--fenSuite` uses the curated FEN suite (paired across colors when swapping).
- `--seed` controls opening/FEN selection and engine RNG.
- Output PGNs + meta JSON + `summary.json` are written to `scripts/bench/quick-results/run-<runId>/`.

Report updates will appear between the markers below.

<!-- REPORT:START -->
Last updated: 2025-12-31T01:07:41.869Z (UTC) | 2025-12-30 20:07:41 ET
Series: Post-fix baseline series

Config: Scorpion hard @ 800ms | Stockfish movetime 500ms | swap=true | fenSuite=true | seed=7000
Commit: 488150a2ecc0f8d5d5559b3eafaed25efce723fa
Command: C:\Program Files\nodejs\node.exe H:\chess\scripts\bench\quickVsStockfish.ts --stockfish C:\Users\snake\Downloads\stockfish-windows-x86-64-avx2\stockfish\stockfish-windows-x86-64-avx2.exe --batch 25 --movetime 800 --stockfishMovetime 500 --mode hard --swap --fenSuite --seed 7000 --runId phase5_1d-kingSafety-queenGate-coeff4-hard800-vs-sf500-b25 --reset
Stockfish: C:\Users\snake\Downloads\stockfish-windows-x86-64-avx2\stockfish\stockfish-windows-x86-64-avx2.exe
Settings: Threads=1, Hash=64MB, Ponder=false
Movetime targets: BrainIT=800ms, Stockfish=500ms
Timeout tolerance: +25ms (bench-only stop-latency/jitter slack)
Next ladder rung: paused (Stockfish=500ms)
Output: H:\chess\scripts\bench\quick-results\run-phase5_1d-kingSafety-queenGate-coeff4-hard800-vs-sf500-b25

Cumulative: 0-0-50 (50 games)
Score: 0.000
Elo delta: Outside estimation range (shutout).
Avg plies per game: 32.4
End reasons: mate=50, stalemate=0, repetition=0, 50-move=0, other=0
Timed out moves: 21/797
Avg ms (non-timeout): 792.5, Avg ms (timeout): 914.2
Max ms (non-timeout): 913.8, Max ms (timeout): 921.9

Batch history:
Batch | Games | W | D | L | Score | Elo | BrainIT ms (target/avg) | Stockfish ms (target/avg) | Timeouts | Timed-out moves | Avg ms (ok/timeout) | Max ms (ok/timeout) | Stop Latency (avg ms) | Overhead
--- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---
1 | 50 | 0 | 0 | 50 | 0.000 | n/a | 800/795.7 | 500/427.0 | B:21 SF:0 | 21/797 | 792.5/914.2 | 913.8/921.9 | 5.2 | 152
<!-- REPORT:END -->

Notes
- Results are directional only; high variance is expected.
- \"Timed out moves\" means the harness forced a fallback because a bestmove did not arrive before `movetime + grace`.
- Use the same Stockfish settings (Threads=1, Hash=64, Ponder=false) for all batches.





