# Scorpion Self-Play Report

Latest run summary is always inside the markers below.

<!-- REPORT:START -->
Last updated: 2026-03-23T03:59:13.186Z (UTC) | 2026-03-22 23:59:13 ET
Config: hardMs=1000, maxMs=5000, batch=5, swap=true, fenSuite=true
Commit: e97f06243a64e440b8c6c8a0734d63c1b99b1ad5
Base seed: 9047
Output: H:\chess\benchmarks\selfplay\run-phase5e-se-depth3-seed9047
Cumulative: 4-6-0 (10 games)
Avg plies per game: 115.3
End reasons: mate=4, stalemate=0, repetition=3, 50-move=0, other=3
Repetition rate: 30.0% | Mate rate: 40.0%
Decisiveness: avg captures=19.7, avg pawn moves=16.8
Early repetition count (<30 ply): 1
Avg repetition ply: 107.3
Timing (Hard): avg=908.2ms, max=1049.1ms, timeouts=0
Timing (Max): avg=4759.1ms, max=5059.7ms, timeouts=0

Hard as White vs Max: 2-3-0 (5 games)
Avg plies: 90.8
End reasons: mate=2, stalemate=0, repetition=2, 50-move=0, other=1
Repetition rate: 40.0% | Mate rate: 40.0%
Decisiveness: avg captures=17.0, avg pawn moves=15.8
Early repetition count (<30 ply): 1
Avg repetition ply: 86.7
Timing (Hard): avg=922.2ms, max=1049.1ms, timeouts=0
Timing (Max): avg=4744.3ms, max=5059.7ms, timeouts=0

Max as White vs Hard: 2-3-0 (5 games)
Avg plies: 139.8
End reasons: mate=2, stalemate=0, repetition=1, 50-move=0, other=2
Repetition rate: 20.0% | Mate rate: 40.0%
Decisiveness: avg captures=22.4, avg pawn moves=17.8
Early repetition count (<30 ply): 0
Avg repetition ply: 169.0
Timing (Hard): avg=899.0ms, max=952.7ms, timeouts=0
Timing (Max): avg=4768.6ms, max=5032.5ms, timeouts=0

Notes:
- Deterministic base seed used; move-level seeds derived from a fixed RNG.
- Opening suite: fixed UCI sequences applied before engine play; selection is seed-based.
- FEN suite: FENs are derived from curated UCI sequences and selected by seed.
- Early repetition rerolls are counted in repetition diagnostics but not in W/D/L totals.
- Decisiveness metrics (captures/pawn moves) include opening or FEN start moves.
- Segment W/D/L lines are reported from Hard's perspective.
- SAN generation uses engine move legality; if SAN is missing for any move, check meta JSON.

<!-- REPORT:END -->
