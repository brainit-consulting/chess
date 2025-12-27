# BrainIT vs Stockfish Report (Quick Run)

This report tracks the quick-and-dirty benchmark batches. Each run executes a
fixed number of games (default: 10) and updates the cumulative results here.

How to run a batch:

```
npm run bench:quick -- --stockfish "C:\path\to\stockfish.exe" --batch 10 --movetime 100 --mode max
```

Report updates will appear between the markers below.

<!-- REPORT:START -->
Last updated: 2025-12-27T22:48:07.913Z
Series: Post-fix baseline series

Config: BrainIT hard @ 200ms | Stockfish movetime 200ms
Stockfish: C:\Users\snake\Downloads\stockfish-windows-x86-64-avx2\stockfish\stockfish-windows-x86-64-avx2.exe
Settings: Threads=1, Hash=64MB, Ponder=false
Movetime targets: BrainIT=200ms, Stockfish=200ms
Next ladder rung: paused (Stockfish=200ms)

Cumulative: 0-0-26 (26 games)
Score: 0.000
Elo delta: Outside estimation range (shutout).
Avg plies per game: 34.8
End reasons: mate=20, stalemate=0, repetition=0, 50-move=0, other=0
Timed out moves: 282/283
Avg ms (non-timeout): 203.9, Avg ms (timeout): 290.7
Max ms (non-timeout): 203.9, Max ms (timeout): 297.4

Batch history:
Batch | Games | W | D | L | Score | Elo | BrainIT ms (target/avg) | Stockfish ms (target/avg) | Timeouts | Timed-out moves | Avg ms (ok/timeout) | Max ms (ok/timeout) | Stop Latency (avg ms) | Overhead
--- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---
1 | 10 | 0 | 0 | 10 | 0.000 | n/a | 200/289.0 | 200/178.3 | B:131 SF:0 | 131/132 | 203.9/289.7 | 203.9/297.1 | 0.7 | 1
2 | 10 | 0 | 0 | 10 | 0.000 | n/a | 200/291.6 | 200/178.9 | B:151 SF:0 | 151/151 | 0.0/291.6 | 0.0/297.4 | 0.0 | 0
<!-- REPORT:END -->

Notes
- Results are directional only; high variance is expected.
- Use the same Stockfish settings (Threads=1, Hash=64, Ponder=false) for all batches.
