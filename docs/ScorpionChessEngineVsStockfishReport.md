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
Last updated: 2025-12-30T14:56:38.656Z
Series: Post-fix baseline series

Config: Scorpion hard @ 200ms | Stockfish movetime 200ms | swap=true | fenSuite=true | seed=7000
Commit: f2a396a83792457c4b1d0d9e3bc59e2faf064059
Command: C:\Program Files\nodejs\node.exe H:\chess\scripts\bench\quickVsStockfish.ts --stockfish C:\Users\snake\Downloads\stockfish-windows-x86-64-avx2\stockfish\stockfish-windows-x86-64-avx2.exe --batch 10 --movetime 200 --mode hard --swap --fenSuite --seed 7000 --runId quick-10-swap --reset
Stockfish: C:\Users\snake\Downloads\stockfish-windows-x86-64-avx2\stockfish\stockfish-windows-x86-64-avx2.exe
Settings: Threads=1, Hash=64MB, Ponder=false
Movetime targets: BrainIT=200ms, Stockfish=200ms
Next ladder rung: paused (Stockfish=200ms)
Output: H:\chess\scripts\bench\quick-results\run-quick-10-swap

Cumulative: 0-0-20 (20 games)
Score: 0.000
Elo delta: Outside estimation range (shutout).
Avg plies per game: 29.3
End reasons: mate=20, stalemate=0, repetition=0, 50-move=0, other=0
Timed out moves: 10/288
Avg ms (non-timeout): 202.7, Avg ms (timeout): 288.3
Max ms (non-timeout): 215.8, Max ms (timeout): 294.6

Batch history:
Batch | Games | W | D | L | Score | Elo | BrainIT ms (target/avg) | Stockfish ms (target/avg) | Timeouts | Timed-out moves | Avg ms (ok/timeout) | Max ms (ok/timeout) | Stop Latency (avg ms) | Overhead
--- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---
1 | 20 | 0 | 0 | 20 | 0.000 | n/a | 200/205.7 | 200/175.9 | B:10 SF:0 | 10/288 | 202.7/288.3 | 215.8/294.6 | 2.5 | 57
<!-- REPORT:END -->

Notes
- Results are directional only; high variance is expected.
- \"Timed out moves\" means the harness forced a fallback because a bestmove did not arrive before `movetime + grace`.
- Use the same Stockfish settings (Threads=1, Hash=64, Ponder=false) for all batches.
