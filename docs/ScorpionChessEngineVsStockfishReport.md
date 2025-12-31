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
Last updated: 2025-12-31T14:31:56.019Z (UTC) | 2025-12-31 09:31:56 ET
Series: Post-fix baseline series

Config: Scorpion hard @ 800ms | Stockfish movetime 500ms | swap=true | fenSuite=true | seed=7000
Commit: 53ddc6b16ecf7174fd5c9b550d3e4c8476267d79
Command: C:\Program Files\nodejs\node.exe H:\chess\scripts\bench\quickVsStockfish.ts --stockfish C:\Users\snake\Downloads\stockfish-windows-x86-64-avx2\stockfish\stockfish-windows-x86-64-avx2.exe --batch 25 --movetime 800 --stockfishMovetime 500 --mode hard --swap --fenSuite --seed 7000 --runId phase5_q2-killerLite-hard800-vs-sf500-b25 --reset
Stockfish: C:\Users\snake\Downloads\stockfish-windows-x86-64-avx2\stockfish\stockfish-windows-x86-64-avx2.exe
Settings: Threads=1, Hash=64MB, Ponder=false
Movetime targets: Scorpion=800ms, Stockfish=500ms
Timeout tolerance: +25ms (bench-only stop-latency/jitter slack)
Next ladder rung: paused (Stockfish=500ms)
Output: H:\chess\scripts\bench\quick-results\run-phase5_q2-killerLite-hard800-vs-sf500-b25

Cumulative: 0-1-49 (50 games)
Score: 0.010
Elo delta: -798 (95% CI -1192 to -404)
Avg plies per game: 34.7
End reasons: mate=49, stalemate=0, repetition=1, 50-move=0, other=0
Timed out moves: 18/855
Avg ms (non-timeout): 799.5, Avg ms (timeout): 913.8
Max ms (non-timeout): 916.5, Max ms (timeout): 924.5

Batch history:
Batch | Games | W | D | L | Score | Elo | Scorpion ms (target/avg) | Stockfish ms (target/avg) | Timeouts | Timed-out moves | Avg ms (ok/timeout) | Max ms (ok/timeout) | Stop Latency (avg ms) | Overhead
--- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---
1 | 50 | 0 | 1 | 49 | 0.010 | -798 | 800/801.9 | 500/434.4 | B:18 SF:0 | 18/855 | 799.5/913.8 | 916.5/924.5 | 6.6 | 154
<!-- REPORT:END -->

Notes
- Results are directional only; high variance is expected.
- \"Timed out moves\" means the harness forced a fallback because a bestmove did not arrive before `movetime + grace`.
- Use the same Stockfish settings (Threads=1, Hash=64, Ponder=false) for all batches.
- RunId references: baseline v1.1.55 reconfirm `phase4_3-reconfirm-hard800-vs-sf500-b25`, phase5_1b `phase5_1b-kingSafety-hard800-vs-sf500-b25`, phase5_1c `phase5_1c-kingSafety-queenGate-hard800-vs-sf500-b25`, phase5_1d (reverted) `phase5_1d-kingSafety-queenGate-coeff4-hard800-vs-sf500-b25`.
- Note: phase5_q3-hard800-vs-sf500-b25 was rolled back due to avg plies 37.6 < 38.0.





