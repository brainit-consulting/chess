# Scorpion Self-Play Report

Latest run summary is always inside the markers below.

<!-- REPORT:START -->
Last updated: 2026-03-22T16:06:44.529Z (UTC) | 2026-03-22 12:06:44 ET
Config: hardMs=1000, maxMs=5000, batch=5, swap=true, fenSuite=true
Commit: 564b57540415fc053df6ea14a247a2fbbabf3c2f
Base seed: 9045
Output: H:\chess\benchmarks\selfplay\run-phase5d-qsearch-gc-seed9045
Cumulative: 2-8-0 (10 games)
Avg plies per game: 135.1
End reasons: mate=2, stalemate=0, repetition=6, 50-move=0, other=2
Repetition rate: 60.0% | Mate rate: 20.0%
Decisiveness: avg captures=21.3, avg pawn moves=15.8
Early repetition count (<30 ply): 0
Avg repetition ply: 145.5
Timing (Hard): avg=944.8ms, max=1261.6ms, timeouts=11
Timing (Max): avg=4811.6ms, max=5368.5ms, timeouts=32

Hard as White vs Max: 1-4-0 (5 games)
Avg plies: 129.2
End reasons: mate=1, stalemate=0, repetition=3, 50-move=0, other=1
Repetition rate: 60.0% | Mate rate: 20.0%
Decisiveness: avg captures=22.2, avg pawn moves=15.2
Early repetition count (<30 ply): 0
Avg repetition ply: 136.0
Timing (Hard): avg=945.2ms, max=1261.6ms, timeouts=10
Timing (Max): avg=4810.1ms, max=5368.5ms, timeouts=13

Max as White vs Hard: 1-4-0 (5 games)
Avg plies: 141.0
End reasons: mate=1, stalemate=0, repetition=3, 50-move=0, other=1
Repetition rate: 60.0% | Mate rate: 20.0%
Decisiveness: avg captures=20.4, avg pawn moves=16.4
Early repetition count (<30 ply): 0
Avg repetition ply: 155.0
Timing (Hard): avg=944.4ms, max=1235.1ms, timeouts=1
Timing (Max): avg=4813.0ms, max=5340.0ms, timeouts=19

Notes:
- Deterministic base seed used; move-level seeds derived from a fixed RNG.
- Opening suite: fixed UCI sequences applied before engine play; selection is seed-based.
- FEN suite: FENs are derived from curated UCI sequences and selected by seed.
- Early repetition rerolls are counted in repetition diagnostics but not in W/D/L totals.
- Decisiveness metrics (captures/pawn moves) include opening or FEN start moves.
- Segment W/D/L lines are reported from Hard's perspective.
- SAN generation uses engine move legality; if SAN is missing for any move, check meta JSON.

<!-- REPORT:END -->
