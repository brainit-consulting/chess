# BrainIT vs Stockfish Report (Quick Run)

This report tracks the quick-and-dirty benchmark batches. Each run executes a
fixed number of games (default: 10) and updates the cumulative results here.

How to run a batch:

```
npm run bench:quick -- --stockfish "C:\path\to\stockfish.exe" --batch 10 --movetime 100 --mode max
```

Report updates will appear between the markers below.

<!-- REPORT:START -->
Last updated: 2025-12-27T20:53:10.359Z
Series: Post-fix baseline series

Config: BrainIT hard @ 150ms | Stockfish movetime 150ms
Stockfish: C:\Users\snake\Downloads\stockfish-windows-x86-64-avx2\stockfish\stockfish-windows-x86-64-avx2.exe
Settings: Threads=1, Hash=64MB, Ponder=false
Movetime targets: BrainIT=150ms, Stockfish=150ms
Next ladder rung: paused (Stockfish=150ms)

Cumulative: 0-0-10 (10 games)
Score: 0.000
Elo delta: Outside estimation range (shutout).
Avg plies per game: 36.1
End reasons: mate=10, stalemate=0, repetition=0, 50-move=0, other=0

Batch history:
Batch | Games | W | D | L | Score | Elo | BrainIT ms (target/avg) | Stockfish ms (target/avg) | Timeouts | Stop Latency (avg ms) | Overhead
--- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---
1 | 10 | 0 | 0 | 10 | 0.000 | n/a | 150/197.2 | 150/133.2 | B:148 SF:0 | 0.0 | 0
<!-- REPORT:END -->

Notes
- Results are directional only; high variance is expected.
- Use the same Stockfish settings (Threads=1, Hash=64, Ponder=false) for all batches.
