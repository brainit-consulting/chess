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
Last updated: 2025-12-30T15:16:34.647Z
Series: Post-fix baseline series

Config: Scorpion hard @ 800ms | Stockfish movetime 800ms | swap=true | fenSuite=true | seed=7000
Commit: 46d868ffc52012b027a71e379fe5e3567b89d6c9
Command: C:\Program Files\nodejs\node.exe H:\chess\scripts\bench\quickVsStockfish.ts --stockfish C:\Users\snake\Downloads\stockfish-windows-x86-64-avx2\stockfish\stockfish-windows-x86-64-avx2.exe --batch 5 --movetime 800 --mode hard --swap --fenSuite --seed 7000 --runId phase4_2-hard800-sanity-rerun --reset
Stockfish: C:\Users\snake\Downloads\stockfish-windows-x86-64-avx2\stockfish\stockfish-windows-x86-64-avx2.exe
Settings: Threads=1, Hash=64MB, Ponder=false
Movetime targets: BrainIT=800ms, Stockfish=800ms
Next ladder rung: paused (Stockfish=800ms)
Output: H:\chess\scripts\bench\quick-results\run-phase4_2-hard800-sanity-rerun

Cumulative: 0-0-10 (10 games)
Score: 0.000
Elo delta: Outside estimation range (shutout).
Avg plies per game: 32.1
End reasons: mate=10, stalemate=0, repetition=0, 50-move=0, other=0
Timed out moves: 3/158
Avg ms (non-timeout): 791.1, Avg ms (timeout): 887.2
Max ms (non-timeout): 887.9, Max ms (timeout): 891.8

Batch history:
Batch | Games | W | D | L | Score | Elo | BrainIT ms (target/avg) | Stockfish ms (target/avg) | Timeouts | Timed-out moves | Avg ms (ok/timeout) | Max ms (ok/timeout) | Stop Latency (avg ms) | Overhead
--- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---
1 | 10 | 0 | 0 | 10 | 0.000 | n/a | 800/793.0 | 800/685.5 | B:3 SF:0 | 3/158 | 791.1/887.2 | 887.9/891.8 | 8.8 | 22
<!-- REPORT:END -->

Notes
- Results are directional only; high variance is expected.
- \"Timed out moves\" means the harness forced a fallback because a bestmove did not arrive before `movetime + grace`.
- Use the same Stockfish settings (Threads=1, Hash=64, Ponder=false) for all batches.
