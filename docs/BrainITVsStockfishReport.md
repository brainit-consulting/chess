# BrainIT vs Stockfish Report (Quick Run)

This report tracks the quick-and-dirty benchmark batches. Each run executes a
fixed number of games (default: 10) and updates the cumulative results here.

How to run a batch:

```
npm run bench:quick -- --stockfish "C:\path\to\stockfish.exe" --batch 10 --movetime 100 --mode max
```

Report updates will appear between the markers below.

<!-- REPORT:START -->
Last updated: 2025-12-28T02:32:58.974Z
Series: Post-fix baseline series
Note: series reset due to corrupted quick-run-state.json; prior series remains above for reference.

Config: BrainIT hard @ 200ms | Stockfish movetime 200ms
Stockfish: C:\Users\snake\Downloads\stockfish-windows-x86-64-avx2\stockfish\stockfish-windows-x86-64-avx2.exe
Settings: Threads=1, Hash=64MB, Ponder=false
Movetime targets: BrainIT=200ms, Stockfish=200ms
Next ladder rung: paused (Stockfish=200ms)

Cumulative: 0-0-12 (12 games)
Score: 0.000
Elo delta: Outside estimation range (shutout).
Avg plies per game: 37.2
End reasons: mate=12, stalemate=0, repetition=0, 50-move=0, other=0
Timed out moves: 6/184
Avg ms (non-timeout): 203.1, Avg ms (timeout): 290.1
Max ms (non-timeout): 216.4, Max ms (timeout): 294.4

Batch history:
Batch | Games | W | D | L | Score | Elo | BrainIT ms (target/avg) | Stockfish ms (target/avg) | Timeouts | Timed-out moves | Avg ms (ok/timeout) | Max ms (ok/timeout) | Stop Latency (avg ms) | Overhead
--- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---
1 | 2 | 0 | 0 | 2 | 0.000 | n/a | 200/207.3 | 200/163.6 | B:1 SF:0 | 1/25 | 203.8/292.1 | 214.5/292.1 | 6.0 | 6
2 | 10 | 0 | 0 | 10 | 0.000 | n/a | 200/205.7 | 200/176.3 | B:5 SF:0 | 5/159 | 203.0/289.7 | 216.4/294.4 | 2.8 | 41
<!-- REPORT:END -->

Notes
- Results are directional only; high variance is expected.
- Use the same Stockfish settings (Threads=1, Hash=64, Ponder=false) for all batches.
