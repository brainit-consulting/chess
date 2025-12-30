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
Last updated: 2025-12-30T16:06:26.772Z (UTC) | 2025-12-30 11:06:26 ET
Series: Post-fix baseline series

Config: Scorpion hard @ 800ms | Stockfish movetime 600ms | swap=true | fenSuite=true | seed=7000
Commit: 4919f60f90767034216b7fc1b4de20ae358c514d
Command: C:\Program Files\nodejs\node.exe H:\chess\scripts\bench\quickVsStockfish.ts --stockfish C:\Users\snake\Downloads\stockfish-windows-x86-64-avx2\stockfish\stockfish-windows-x86-64-avx2.exe --batch 10 --movetime 800 --stockfishMovetime 600 --mode hard --swap --fenSuite --seed 7000 --runId phase4_2-hard800-vs-sf600-b10 --reset
Stockfish: C:\Users\snake\Downloads\stockfish-windows-x86-64-avx2\stockfish\stockfish-windows-x86-64-avx2.exe
Settings: Threads=1, Hash=64MB, Ponder=false
Movetime targets: BrainIT=800ms, Stockfish=600ms
Timeout tolerance: +25ms (bench-only stop-latency/jitter slack)
Next ladder rung: paused (Stockfish=600ms)
Output: H:\chess\scripts\bench\quick-results\run-phase4_2-hard800-vs-sf600-b10

Cumulative: 0-1-19 (20 games)
Score: 0.025
Elo delta: -636 (95% CI -1033 to -240)
Avg plies per game: 33.7
End reasons: mate=19, stalemate=0, repetition=1, 50-move=0, other=0
Timed out moves: 3/332
Avg ms (non-timeout): 798.5, Avg ms (timeout): 911.3
Max ms (non-timeout): 898.5, Max ms (timeout): 914.3

Batch history:
Batch | Games | W | D | L | Score | Elo | BrainIT ms (target/avg) | Stockfish ms (target/avg) | Timeouts | Timed-out moves | Avg ms (ok/timeout) | Max ms (ok/timeout) | Stop Latency (avg ms) | Overhead
--- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---
1 | 20 | 0 | 1 | 19 | 0.025 | -636 | 800/799.5 | 600/515.7 | B:3 SF:0 | 3/332 | 798.5/911.3 | 898.5/914.3 | 11.8 | 63
<!-- REPORT:END -->

Notes
- Results are directional only; high variance is expected.
- \"Timed out moves\" means the harness forced a fallback because a bestmove did not arrive before `movetime + grace`.
- Use the same Stockfish settings (Threads=1, Hash=64, Ponder=false) for all batches.
