# BrainIT vs Stockfish Report (Quick Run)

This report tracks the quick-and-dirty benchmark batches. Each run executes a
fixed number of games (default: 10) and updates the cumulative results here.

How to run a batch:

```
npm run bench:quick -- --stockfish "C:\path\to\stockfish.exe" --batch 10 --movetime 100 --mode max
```

Report updates will appear between the markers below.

<!-- REPORT:START -->
Last updated: 2025-12-27T19:46:10.775Z

Config: BrainIT hard @ 100ms | Stockfish movetime 100ms
Stockfish: C:\Users\snake\Downloads\stockfish-windows-x86-64-avx2\stockfish\stockfish-windows-x86-64-avx2.exe
Settings: Threads=1, Hash=64MB, Ponder=false
Movetime targets: BrainIT=100ms, Stockfish=100ms
Next ladder rung: paused (Stockfish=100ms)

Cumulative: 0-50-13 (63 games)
Score: 0.397
Elo delta: -73 (95% CI -160 to +14)
Avg plies per game: 5.6
End reasons: mate=10, stalemate=0, repetition=0, 50-move=0, other=50

WARNING: Invalid benchmark: games terminated too early.

Batch history:
Batch | Games | W | D | L | Score | Elo | BrainIT ms (target/avg) | Stockfish ms (target/avg) | Timeouts | Stop Latency (avg ms) | Overhead
--- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---
1 | 10 | 0 | 10 | 0 | 0.500 | +0 | 100/119.9 | 100/100.7 | B:0 SF:0 | 0.0 | 0
2 | 40 | 0 | 40 | 0 | 0.500 | +0 | 100/113.0 | 100/100.5 | B:2 SF:0 | 0.0 | 0
3 | 10 | 0 | 0 | 10 | 0.000 | n/a | 100/145.9 | 100/88.8 | B:125 SF:0 | 0.0 | 0
<!-- REPORT:END -->

Notes
- Results are directional only; high variance is expected.
- Use the same Stockfish settings (Threads=1, Hash=64, Ponder=false) for all batches.
