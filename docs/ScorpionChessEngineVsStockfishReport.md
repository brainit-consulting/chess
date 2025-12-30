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
Last updated: 2025-12-28T12:13:35.945Z
Series: Post-fix baseline series

Config: Scorpion hard @ 200ms | Stockfish movetime 200ms
Stockfish: C:\Users\snake\Downloads\stockfish-windows-x86-64-avx2\stockfish\stockfish-windows-x86-64-avx2.exe
Settings: Threads=1, Hash=64MB, Ponder=false
Movetime targets: Scorpion=200ms, Stockfish=200ms
Next ladder rung: paused (Stockfish=200ms)

Cumulative: 0-0-22 (22 games)
Score: 0.000
Elo delta: Outside estimation range (shutout).
Avg plies per game: 36.4
End reasons: mate=22, stalemate=0, repetition=0, 50-move=0, other=0
Timed out moves: 11/329
Avg ms (non-timeout): 203.3, Avg ms (timeout): 290.3
Max ms (non-timeout): 219.5, Max ms (timeout): 294.4

Batch history:
Batch | Games | W | D | L | Score | Elo | Scorpion ms (target/avg) | Stockfish ms (target/avg) | Timeouts | Timed-out moves | Avg ms (ok/timeout) | Max ms (ok/timeout) | Stop Latency (avg ms) | Overhead
--- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---
1 | 2 | 0 | 0 | 2 | 0.000 | n/a | 200/207.3 | 200/163.6 | S:1 SF:0 | 1/25 | 203.8/292.1 | 214.5/292.1 | 6.0 | 6
2 | 10 | 0 | 0 | 10 | 0.000 | n/a | 200/205.7 | 200/176.3 | S:5 SF:0 | 5/159 | 203.0/289.7 | 216.4/294.4 | 2.8 | 41
3 | 10 | 0 | 0 | 10 | 0.000 | n/a | 200/206.7 | 200/182.1 | S:5 SF:0 | 5/145 | 203.7/290.4 | 219.5/294.2 | 3.7 | 30
<!-- REPORT:END -->

Notes
- Results are directional only; high variance is expected.
- \"Timed out moves\" means the harness forced a fallback because a bestmove did not arrive before `movetime + grace`.
- Use the same Stockfish settings (Threads=1, Hash=64, Ponder=false) for all batches.
