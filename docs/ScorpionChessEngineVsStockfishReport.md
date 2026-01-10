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
Last updated: 2026-01-10T21:42:09.482Z (UTC) | 2026-01-10 16:42:09 ET
Series: Post-fix baseline series
Roadmap phase: Unknown

Config: Scorpion max @ 10000ms | Stockfish movetime 5ms | swap=true | fenSuite=true | seed=7000
Commit: 3cfe245ae0302874d820cce99f6b78f791bd8d00
Command: C:\Program Files\nodejs\node.exe H:\chess\scripts\bench\quickVsStockfish.ts --stockfish H:\chess\bin\ScorpionHeart.exe --reset --mode max --movetime 15000 --sf-ladder 5,10,20,40,80 --games 6 --swap --fenSuite --threads 1 --hash 128 --max-plies 200 --seed 7000 --runId max15s_sf_ladder_weak6_swap --outDir H:\chess\benchmarks\baseline\max15s_sf_ladder_weak6_swap
Stockfish: H:\chess\bin\ScorpionHeart.exe
Settings: Threads=1, Hash=128MB, Ponder=false
Movetime targets: Scorpion=10000ms, Stockfish=5ms
Timeout tolerance: +25ms (bench-only stop-latency/jitter slack)
Next ladder rung: paused (Stockfish=5ms)
Output: H:\chess\benchmarks\baseline\max15s_sf_ladder_weak6_swap

Cumulative: 0-1-11 (12 games)
Score: 0.042
Elo delta: -545 (95% CI -943 to -146)
Avg plies per game: 67.6
End reasons: mate=11, stalemate=0, repetition=1, 50-move=0, other=0
Timed out moves: 1/403
Avg ms (non-timeout): 9688.4, Avg ms (timeout): 10118.8
Max ms (non-timeout): 10084.5, Max ms (timeout): 10118.8

Batch history:
Batch | Games | W | D | L | Score | Elo | Scorpion ms (target/avg) | Stockfish ms (target/avg) | Timeouts | Timed-out moves | Avg ms (ok/timeout) | Max ms (ok/timeout) | Stop Latency (avg ms) | Overhead
--- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---
1 | 12 | 0 | 1 | 11 | 0.042 | -545 | 10000/9689.4 | 5/5.0 | B:1 SF:0 | 1/403 | 9688.4/10118.8 | 10084.5/10118.8 | 56.0 | 3

Last updated: 2026-01-10T00:26:56.292Z (UTC) | 2026-01-09 19:26:56 ET
Series: Post-fix baseline series
Roadmap phase: Unknown

Config: Scorpion max @ 10000ms | Stockfish movetime 3000ms | swap=true | fenSuite=true | seed=7000
Commit: 3cfe245ae0302874d820cce99f6b78f791bd8d00
Command: C:\Program Files\nodejs\node.exe H:\chess\scripts\bench\quickVsStockfish.ts --stockfish H:\chess\bin\ScorpionHeart.exe --reset --mode max --movetime 15000 --sf-ladder 3000,5000,8000,12000,15000,20000 --games 80 --swap --fenSuite --threads 1 --hash 128 --max-plies 200 --seed 7000 --runId max15s_sf_ladder --outDir H:\chess\benchmarks\baseline\max15s_sf_ladder
Stockfish: H:\chess\bin\ScorpionHeart.exe
Settings: Threads=1, Hash=128MB, Ponder=false
Movetime targets: Scorpion=10000ms, Stockfish=3000ms
Timeout tolerance: +25ms (bench-only stop-latency/jitter slack)
Next ladder rung: paused (Stockfish=3000ms)
Output: H:\chess\benchmarks\baseline\max15s_sf_ladder

Cumulative: 0-1-159 (160 games)
Score: 0.003
Elo delta: -1002 (95% CI -1394 to -609)
Avg plies per game: 45.5
End reasons: mate=159, stalemate=0, repetition=1, 50-move=0, other=0
Timed out moves: 46/3604
Avg ms (non-timeout): 9788.5, Avg ms (timeout): 10114.3
Max ms (non-timeout): 10109.6, Max ms (timeout): 10129.8

Batch history:
Batch | Games | W | D | L | Score | Elo | Scorpion ms (target/avg) | Stockfish ms (target/avg) | Timeouts | Timed-out moves | Avg ms (ok/timeout) | Max ms (ok/timeout) | Stop Latency (avg ms) | Overhead
--- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---
1 | 160 | 0 | 1 | 159 | 0.003 | -1002 | 10000/9792.6 | 3000/2628.3 | B:46 SF:0 | 46/3604 | 9788.5/10114.3 | 10109.6/10129.8 | 38.6 | 105

Last updated: 2026-01-09T00:34:39.210Z (UTC) | 2026-01-08 19:34:39 ET
Series: Post-fix baseline series
Roadmap phase: Unknown

Config: Scorpion max @ 10000ms | Stockfish movetime 3000ms | swap=true | fenSuite=true | seed=7000
Commit: 3cfe245ae0302874d820cce99f6b78f791bd8d00
Command: C:\Program Files\nodejs\node.exe H:\chess\scripts\bench\quickVsStockfish.ts --stockfish H:\chess\bin\ScorpionHeart.exe --reset --mode max --movetime 15000 --sf-ladder 3000,5000,8000,12000,15000,20000 --games 80 --swap --fenSuite --threads 1 --hash 128 --max-plies 200 --seed 7000 --runId max15s_sf_ladder --outDir H:\chess\benchmarks\baseline\max15s_sf_ladder
Stockfish: H:\chess\bin\ScorpionHeart.exe
Settings: Threads=1, Hash=128MB, Ponder=false
Movetime targets: Scorpion=10000ms, Stockfish=3000ms
Timeout tolerance: +25ms (bench-only stop-latency/jitter slack)
Next ladder rung: paused (Stockfish=3000ms)
Output: H:\chess\benchmarks\baseline\max15s_sf_ladder

Cumulative: 0-2-158 (160 games)
Score: 0.006
Elo delta: -881 (95% CI -1183 to -579)
Avg plies per game: 44.9
End reasons: mate=158, stalemate=0, repetition=2, 50-move=0, other=0
Timed out moves: 66/3554
Avg ms (non-timeout): 9800.6, Avg ms (timeout): 10115.3
Max ms (non-timeout): 10113.3, Max ms (timeout): 10181.7

Batch history:
Batch | Games | W | D | L | Score | Elo | Scorpion ms (target/avg) | Stockfish ms (target/avg) | Timeouts | Timed-out moves | Avg ms (ok/timeout) | Max ms (ok/timeout) | Stop Latency (avg ms) | Overhead
--- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---
1 | 160 | 0 | 2 | 158 | 0.006 | -881 | 10000/9806.4 | 3000/2627.6 | B:66 SF:2 | 66/3554 | 9800.6/10115.3 | 10113.3/10181.7 | 39.3 | 120

Last updated: 2026-01-02T19:44:52.084Z (UTC) | 2026-01-02 14:44:52 ET
Series: Post-fix baseline series
Roadmap phase: Unknown

Config: Scorpion hard @ 1000ms | Stockfish movetime 500ms | swap=true | fenSuite=true | seed=7000
Commit: 8a9865f21e9851b4b99f10cb0e7d82bae6c75d6a
Command: C:\Program Files\nodejs\node.exe H:\chess\scripts\bench\quickVsStockfish.ts --stockfish C:\Users\snake\Downloads\stockfish-windows-x86-64-avx2\stockfish\stockfish-windows-x86-64-avx2.exe --batch 6 --movetime 1000 --stockfishMovetime 500 --mode hard --swap --fenSuite --seed 7000 --runId phase9-diag-hard1000-vs-sf500-b6-seed7000-r6 --reset
Stockfish: C:\Users\snake\Downloads\stockfish-windows-x86-64-avx2\stockfish\stockfish-windows-x86-64-avx2.exe
Settings: Threads=1, Hash=64MB, Ponder=false
Movetime targets: Scorpion=1000ms, Stockfish=500ms
Timeout tolerance: +25ms (bench-only stop-latency/jitter slack)
Next ladder rung: paused (Stockfish=500ms)
Output: H:\chess\scripts\bench\quick-results\run-phase9-diag-hard1000-vs-sf500-b6-seed7000-r6

Cumulative: 0-0-12 (12 games)
Score: 0.000
Elo delta: Outside estimation range (shutout).
Avg plies per game: 38.0
End reasons: mate=12, stalemate=0, repetition=0, 50-move=0, other=0
Timed out moves: 2/225
Avg ms (non-timeout): 952.9, Avg ms (timeout): 1109.4
Max ms (non-timeout): 1095.3, Max ms (timeout): 1112.9

Batch history:
Batch | Games | W | D | L | Score | Elo | Scorpion ms (target/avg) | Stockfish ms (target/avg) | Timeouts | Timed-out moves | Avg ms (ok/timeout) | Max ms (ok/timeout) | Stop Latency (avg ms) | Overhead
--- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---
1 | 12 | 0 | 0 | 12 | 0.000 | n/a | 1000/954.3 | 500/440.8 | B:2 SF:0 | 2/225 | 952.9/1109.4 | 1095.3/1112.9 | 12.4 | 33

Last updated: 2026-01-01T16:36:07.089Z (UTC) | 2026-01-01 11:36:07 ET
Series: Phase 8.4 analysis (Stockfish annotation)
Roadmap phase: Phase 8.4

Input runId: phase8-regress-hard1000-vs-sf500-b6-rerun1
Analysis: depth=12 (full), depth16 recheck on Δeval>=300 (±2 plies)
Output: analysis/phase8-regress-hard1000-vs-sf500-b6-rerun1/summary.json

Earliest mate detection ply (counts): 12x1, 15x1, 25x2, 30x2, 34x1, 36x1, 37x2, 39x2 (min=12, median=32, max=39)
First eval <= -300cp ply (counts): 2x1, 4x3, 5x1, 6x1, 7x3, 11x1, 13x2 (min=2, median=6.5, max=13)
First eval <= -500cp ply (counts): 2x1, 4x2, 5x1, 6x1, 7x1, 10x1, 11x1, 13x1, 15x1, 16x1, 17x1 (min=2, median=8.5, max=17)
Eval swing counts: Δ>=150=63, Δ>=300=43, Δ>=500=39

Motifs (counts): king_safety=33, missed_defense=7, hanging_piece=1
Collapse windows (examples):
- g3: ply 2->37, PV: d8g5 d2d3 g5d8 f2f4 f8b4 c2c3 b4d6 f4e5
- g2: ply 7->25, PV: g2g4 h5g6 h3h4 h7h5 f3e5 h5g4 e5g6 f7g6
- g8: ply 13->37, PV: a2a3 b7b5 a3b4 c6b4 c1d2 a5a4 a1a4 b4d3

Last updated: 2026-01-01T16:13:31.151Z (UTC) | 2026-01-01 11:13:31 ET
Series: Post-fix baseline series
Roadmap phase: Unknown

Config: Scorpion hard @ 1000ms | Stockfish movetime 500ms | swap=true | fenSuite=true | seed=7000
Commit: 1f59e938e5abc4dfdc5969b277ab515562091c9b
Command: C:\Program Files\nodejs\node.exe H:\chess\scripts\bench\quickVsStockfish.ts --stockfish C:\Users\snake\Downloads\stockfish-windows-x86-64-avx2\stockfish\stockfish-windows-x86-64-avx2.exe --batch 6 --movetime 1000 --stockfishMovetime 500 --mode hard --swap --fenSuite --seed 7000 --runId phase8-regress-hard1000-vs-sf500-b6-rerun1 --reset
Stockfish: C:\Users\snake\Downloads\stockfish-windows-x86-64-avx2\stockfish\stockfish-windows-x86-64-avx2.exe
Settings: Threads=1, Hash=64MB, Ponder=false
Movetime targets: Scorpion=1000ms, Stockfish=500ms
Timeout tolerance: +25ms (bench-only stop-latency/jitter slack)
Next ladder rung: paused (Stockfish=500ms)
Output: H:\chess\scripts\bench\quick-results\run-phase8-regress-hard1000-vs-sf500-b6-rerun1

Cumulative: 0-0-12 (12 games)
Score: 0.000
Elo delta: Outside estimation range (shutout).
Avg plies per game: 33.7
End reasons: mate=12, stalemate=0, repetition=0, 50-move=0, other=0
Timed out moves: 1/199
Avg ms (non-timeout): 999.3, Avg ms (timeout): 1119.0
Max ms (non-timeout): 1093.7, Max ms (timeout): 1119.0

Batch history:
Batch | Games | W | D | L | Score | Elo | Scorpion ms (target/avg) | Stockfish ms (target/avg) | Timeouts | Timed-out moves | Avg ms (ok/timeout) | Max ms (ok/timeout) | Stop Latency (avg ms) | Overhead
--- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---
1 | 12 | 0 | 0 | 12 | 0.000 | n/a | 1000/999.9 | 500/424.9 | B:1 SF:0 | 1/199 | 999.3/1119.0 | 1093.7/1119.0 | 15.2 | 31

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





