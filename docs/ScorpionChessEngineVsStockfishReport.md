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
Last updated: 2025-12-30T20:46:43.772Z (UTC) | 2025-12-30 15:46:43 ET
Series: Post-fix baseline series

Config: Scorpion hard @ 800ms | Stockfish movetime 500ms | swap=true | fenSuite=true | seed=7000
Commit: af605dd96924515204dea702fdd93475eecf8469
Command: C:\Program Files\nodejs\node.exe H:\chess\scripts\bench\quickVsStockfish.ts --stockfish C:\Users\snake\Downloads\stockfish-windows-x86-64-avx2\stockfish\stockfish-windows-x86-64-avx2.exe --batch 25 --movetime 800 --stockfishMovetime 500 --mode hard --swap --fenSuite --seed 7000 --runId phase4_4_2-hard800-vs-sf500-b25 --reset
Stockfish: C:\Users\snake\Downloads\stockfish-windows-x86-64-avx2\stockfish\stockfish-windows-x86-64-avx2.exe
Settings: Threads=1, Hash=64MB, Ponder=false
Movetime targets: BrainIT=800ms, Stockfish=500ms
Timeout tolerance: +25ms (bench-only stop-latency/jitter slack)
Next ladder rung: paused (Stockfish=500ms)
Output: H:\chess\scripts\bench\quick-results\run-phase4_4_2-hard800-vs-sf500-b25

Cumulative: 0-1-49 (50 games)
Score: 0.010
Elo delta: -798 (95% CI -1192 to -404)
Avg plies per game: 28.5
End reasons: mate=49, stalemate=0, repetition=1, 50-move=0, other=0
Timed out moves: 21/700
Avg ms (non-timeout): 802.6, Avg ms (timeout): 913.3
Max ms (non-timeout): 914.1, Max ms (timeout): 921.8

Batch history:
Batch | Games | W | D | L | Score | Elo | BrainIT ms (target/avg) | Stockfish ms (target/avg) | Timeouts | Timed-out moves | Avg ms (ok/timeout) | Max ms (ok/timeout) | Stop Latency (avg ms) | Overhead
--- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---
1 | 50 | 0 | 1 | 49 | 0.010 | -798 | 800/805.9 | 500/426.0 | B:21 SF:0 | 21/700 | 802.6/913.3 | 914.1/921.8 | 6.0 | 130
<!-- REPORT:END -->

Notes
- Results are directional only; high variance is expected.
- \"Timed out moves\" means the harness forced a fallback because a bestmove did not arrive before `movetime + grace`.
- Use the same Stockfish settings (Threads=1, Hash=64, Ponder=false) for all batches.

