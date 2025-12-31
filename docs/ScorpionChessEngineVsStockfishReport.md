# ScorpionChessEngineVsStockfish Report (Quick Run)

This report tracks the quick-and-dirty benchmark batches. Each run executes a
fixed number of games (default: 10) and updates the cumulative results here.

How to run a batch (quick bench):

```
npm run bench:quick -- --stockfish "C:\path\to\stockfish.exe" --batch 10 --movetime 1000 --mode hard --swap --fenSuite --seed 7000 --runId phase4_2-quick
```

Notes:
- `--batch` is the per-color game count; with `--swap` enabled the run plays `batch * 2` games.
- `--fenSuite` uses the curated FEN suite (paired across colors when swapping).
- `--seed` controls opening/FEN selection and engine RNG.
- Output PGNs + meta JSON + `summary.json` are written to `scripts/bench/quick-results/run-<runId>/`.

Report updates will appear between the markers below.

<!-- REPORT:START -->
Last updated: 2025-12-31T17:38:08.666Z (UTC) | 2025-12-31 12:38:08 ET
Series: Post-fix baseline series
Roadmap phase: Phase 6

Config: Scorpion hard @ 1200ms | Stockfish movetime 500ms | swap=true | fenSuite=true | seed=7000
Commit: 3185f6fa4413a6fb000ce51b2734bd43bd010fea
Command: C:\Program Files\nodejs\node.exe H:\chess\scripts\bench\quickVsStockfish.ts --stockfish C:\Users\snake\Downloads\stockfish-windows-x86-64-avx2\stockfish\stockfish-windows-x86-64-avx2.exe --batch 25 --movetime 1200 --stockfishMovetime 500 --mode hard --swap --fenSuite --seed 7000 --runId phase6-time-hard1200-rerun1-vs-sf500-b25 --reset
Stockfish: C:\Users\snake\Downloads\stockfish-windows-x86-64-avx2\stockfish\stockfish-windows-x86-64-avx2.exe
Settings: Threads=1, Hash=64MB, Ponder=false
Movetime targets: Scorpion=1200ms, Stockfish=500ms
Timeout tolerance: +25ms (bench-only stop-latency/jitter slack)
Next ladder rung: paused (Stockfish=500ms)
Output: H:\chess\scripts\bench\quick-results\run-phase6-time-hard1200-rerun1-vs-sf500-b25

Cumulative: 0-0-50 (50 games)
Score: 0.000
Elo delta: Outside estimation range (shutout).
Avg plies per game: 37.7
End reasons: mate=50, stalemate=0, repetition=0, 50-move=0, other=0
Timed out moves: 1/931
Avg ms (non-timeout): 1171.9, Avg ms (timeout): 1308.7
Max ms (non-timeout): 1295.5, Max ms (timeout): 1308.7

Batch history:
Batch | Games | W | D | L | Score | Elo | Scorpion ms (target/avg) | Stockfish ms (target/avg) | Timeouts | Timed-out moves | Avg ms (ok/timeout) | Max ms (ok/timeout) | Stop Latency (avg ms) | Overhead
--- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---
1 | 50 | 0 | 0 | 50 | 0.000 | n/a | 1200/1172.0 | 500/439.1 | B:1 SF:0 | 1/931 | 1171.9/1308.7 | 1295.5/1308.7 | 14.8 | 153

Last updated: 2025-12-31T17:02:23.526Z (UTC) | 2025-12-31 12:02:23 ET
Series: Post-fix baseline series
Roadmap phase: Phase 6

Config: Scorpion hard @ 1500ms | Stockfish movetime 500ms | swap=true | fenSuite=true | seed=7000
Commit: 32619401b13cea8a679de834c66b290c2b07f005
Command: C:\Program Files\nodejs\node.exe H:\chess\scripts\bench\quickVsStockfish.ts --stockfish C:\Users\snake\Downloads\stockfish-windows-x86-64-avx2\stockfish\stockfish-windows-x86-64-avx2.exe --batch 25 --movetime 1500 --stockfishMovetime 500 --mode hard --swap --fenSuite --seed 7000 --runId phase6-time-hard1500-rerun1-vs-sf500-b25 --reset
Stockfish: C:\Users\snake\Downloads\stockfish-windows-x86-64-avx2\stockfish\stockfish-windows-x86-64-avx2.exe
Settings: Threads=1, Hash=64MB, Ponder=false
Movetime targets: BrainIT=1500ms, Stockfish=500ms
Timeout tolerance: +25ms (bench-only stop-latency/jitter slack)
Next ladder rung: paused (Stockfish=500ms)
Output: H:\chess\scripts\bench\quick-results\run-phase6-time-hard1500-rerun1-vs-sf500-b25

Cumulative: 0-1-49 (50 games)
Score: 0.010
Elo delta: -798 (95% CI -1192 to -404)
Avg plies per game: 37.3
End reasons: mate=49, stalemate=0, repetition=1, 50-move=0, other=0
Timed out moves: 16/920
Avg ms (non-timeout): 1434.0, Avg ms (timeout): 1611.7
Max ms (non-timeout): 1613.6, Max ms (timeout): 1620.6

Batch history:
Batch | Games | W | D | L | Score | Elo | BrainIT ms (target/avg) | Stockfish ms (target/avg) | Timeouts | Timed-out moves | Avg ms (ok/timeout) | Max ms (ok/timeout) | Stop Latency (avg ms) | Overhead
--- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---
1 | 50 | 0 | 1 | 49 | 0.010 | -798 | 1500/1437.1 | 500/442.0 | B:16 SF:0 | 16/920 | 1434.0/1611.7 | 1613.6/1620.6 | 8.6 | 147

Last updated: 2025-12-31T16:26:13.090Z (UTC) | 2025-12-31 11:26:13 ET
Series: Post-fix baseline series
Roadmap phase: Phase 6

Config: Scorpion hard @ 1500ms | Stockfish movetime 500ms | swap=true | fenSuite=true | seed=7000
Commit: 048673499289be5bfa60a11bc025d4fa748b9aa8
Command: C:\Program Files\nodejs\node.exe H:\chess\scripts\bench\quickVsStockfish.ts --stockfish C:\Users\snake\Downloads\stockfish-windows-x86-64-avx2\stockfish\stockfish-windows-x86-64-avx2.exe --batch 25 --movetime 1500 --stockfishMovetime 500 --mode hard --swap --fenSuite --seed 7000 --runId phase6-time-hard1500-vs-sf500-b25 --reset
Stockfish: C:\Users\snake\Downloads\stockfish-windows-x86-64-avx2\stockfish\stockfish-windows-x86-64-avx2.exe
Settings: Threads=1, Hash=64MB, Ponder=false
Movetime targets: BrainIT=1500ms, Stockfish=500ms
Timeout tolerance: +25ms (bench-only stop-latency/jitter slack)
Next ladder rung: paused (Stockfish=500ms)
Output: H:\chess\scripts\bench\quick-results\run-phase6-time-hard1500-vs-sf500-b25

Cumulative: 0-0-50 (50 games)
Score: 0.000
Elo delta: Outside estimation range (shutout).
Avg plies per game: 37.6
End reasons: mate=50, stalemate=0, repetition=0, 50-move=0, other=0
Timed out moves: 18/928
Avg ms (non-timeout): 1456.5, Avg ms (timeout): 1610.7
Max ms (non-timeout): 1614.8, Max ms (timeout): 1620.7

Batch history:
Batch | Games | W | D | L | Score | Elo | BrainIT ms (target/avg) | Stockfish ms (target/avg) | Timeouts | Timed-out moves | Avg ms (ok/timeout) | Max ms (ok/timeout) | Stop Latency (avg ms) | Overhead
--- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---
1 | 50 | 0 | 0 | 50 | 0.000 | n/a | 1500/1459.5 | 500/435.1 | B:18 SF:0 | 18/928 | 1456.5/1610.7 | 1614.8/1620.7 | 6.9 | 160

Last updated: 2025-12-31T15:49:58.136Z (UTC) | 2025-12-31 10:49:58 ET
Series: Post-fix baseline series
Roadmap phase: Phase 6

Config: Scorpion hard @ 1200ms | Stockfish movetime 500ms | swap=true | fenSuite=true | seed=7000
Commit: d7429ecd0bdc382a47d1469c59bc1a0d77d59747
Command: C:\Program Files\nodejs\node.exe H:\chess\scripts\bench\quickVsStockfish.ts --stockfish C:\Users\snake\Downloads\stockfish-windows-x86-64-avx2\stockfish\stockfish-windows-x86-64-avx2.exe --batch 25 --movetime 1200 --stockfishMovetime 500 --mode hard --swap --fenSuite --seed 7000 --runId phase6-time-hard1200-vs-sf500-b25 --reset
Stockfish: C:\Users\snake\Downloads\stockfish-windows-x86-64-avx2\stockfish\stockfish-windows-x86-64-avx2.exe
Settings: Threads=1, Hash=64MB, Ponder=false
Movetime targets: BrainIT=1200ms, Stockfish=500ms
Timeout tolerance: +25ms (bench-only stop-latency/jitter slack)
Next ladder rung: paused (Stockfish=500ms)
Output: H:\chess\scripts\bench\quick-results\run-phase6-time-hard1200-vs-sf500-b25

Cumulative: 0-0-50 (50 games)
Score: 0.000
Elo delta: Outside estimation range (shutout).
Avg plies per game: 41.1
End reasons: mate=50, stalemate=0, repetition=0, 50-move=0, other=0
Timed out moves: 17/1016
Avg ms (non-timeout): 1178.8, Avg ms (timeout): 1311.3
Max ms (non-timeout): 1318.3, Max ms (timeout): 1321.3

Batch history:
Batch | Games | W | D | L | Score | Elo | BrainIT ms (target/avg) | Stockfish ms (target/avg) | Timeouts | Timed-out moves | Avg ms (ok/timeout) | Max ms (ok/timeout) | Stop Latency (avg ms) | Overhead
--- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---
1 | 50 | 0 | 0 | 50 | 0.000 | n/a | 1200/1181.1 | 500/442.7 | B:17 SF:0 | 17/1016 | 1178.8/1311.3 | 1318.3/1321.3 | 6.9 | 174

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
- RunId references: baseline v1.1.55 reconfirm `phase4_3-reconfirm-hard800-vs-sf500-b25`, phase5_1b `phase5_1b-kingSafety-hard800-vs-sf500-b25`, phase5_1c `phase5_1c-kingSafety-queenGate-hard800-vs-sf500-b25`, phase5_1d (reverted) `phase5_1d-kingSafety-queenGate-coeff4-hard800-vs-sf500-b25`.
- New baseline going forward: hard1000 (hard800 runIds are historical references).





