# Scorpion Self-Play Report

Latest run summary is always inside the markers below.

<!-- REPORT:START -->
Last updated: 2026-03-22T13:31:31.972Z (UTC) | 2026-03-22 09:31:31 ET
Config: hardMs=1000, maxMs=5000, batch=5, swap=true, fenSuite=true
Commit: 2340f373348475e6821598b05b23e70f597bc971
Base seed: 9044
Output: H:\chess\benchmarks\selfplay\run-phase2m-queen-prox-seed9044
Cumulative: 5-5-0 (10 games)
Avg plies per game: 103.2
End reasons: mate=5, stalemate=0, repetition=4, 50-move=0, other=1
Repetition rate: 40.0% | Mate rate: 50.0%
Decisiveness: avg captures=18.9, avg pawn moves=14.8
Early repetition count (<30 ply): 0
Avg repetition ply: 144.0
Timing (Hard): avg=944.0ms, max=1190.6ms, timeouts=5
Timing (Max): avg=4799.9ms, max=5233.2ms, timeouts=8

Hard as White vs Max: 4-1-0 (5 games)
Avg plies: 71.8
End reasons: mate=4, stalemate=0, repetition=1, 50-move=0, other=0
Repetition rate: 20.0% | Mate rate: 80.0%
Decisiveness: avg captures=16.0, avg pawn moves=8.4
Early repetition count (<30 ply): 0
Avg repetition ply: 181.0
Timing (Hard): avg=950.7ms, max=1190.6ms, timeouts=5
Timing (Max): avg=4800.8ms, max=5099.6ms, timeouts=1

Max as White vs Hard: 1-4-0 (5 games)
Avg plies: 134.6
End reasons: mate=1, stalemate=0, repetition=3, 50-move=0, other=1
Repetition rate: 60.0% | Mate rate: 20.0%
Decisiveness: avg captures=21.8, avg pawn moves=21.2
Early repetition count (<30 ply): 0
Avg repetition ply: 131.7
Timing (Hard): avg=940.4ms, max=984.8ms, timeouts=0
Timing (Max): avg=4799.4ms, max=5233.2ms, timeouts=7

Notes:
- Deterministic base seed used; move-level seeds derived from a fixed RNG.
- Opening suite: fixed UCI sequences applied before engine play; selection is seed-based.
- FEN suite: FENs are derived from curated UCI sequences and selected by seed.
- Early repetition rerolls are counted in repetition diagnostics but not in W/D/L totals.
- Decisiveness metrics (captures/pawn moves) include opening or FEN start moves.
- Segment W/D/L lines are reported from Hard's perspective.
- SAN generation uses engine move legality; if SAN is missing for any move, check meta JSON.

<!-- REPORT:END -->
