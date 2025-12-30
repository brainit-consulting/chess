# Scorpion Self-Play Report

Latest run summary is always inside the markers below.

<!-- REPORT:START -->
Last updated: 2025-12-30T13:15:26.518Z (UTC) | 2025-12-30 08:15:26 ET
Config: hardMs=800, maxMs=3000, batch=5, swap=true, fenSuite=true
Commit: 842972a10049a8502abf109c5be521f050f81380
Base seed: 7000
Output: H:\chess\benchmarks\selfplay\run-phase4_1b-fastcheck
Cumulative: 7-3-0 (10 games)
Avg plies per game: 115.7
End reasons: mate=7, stalemate=0, repetition=1, 50-move=0, other=2
Repetition rate: 10.0% | Mate rate: 70.0%
Decisiveness: avg captures=18.7, avg pawn moves=14.2
Early repetition count (<30 ply): 0
Avg repetition ply: 183.0
Timing (Hard): avg=793.4ms, max=1053.2ms, timeouts=10
Timing (Max): avg=3008.7ms, max=3363.0ms, timeouts=10

Hard as White vs Max: 4-1-0 (5 games)
Avg plies: 93.2
End reasons: mate=4, stalemate=0, repetition=0, 50-move=0, other=1
Repetition rate: 0.0% | Mate rate: 80.0%
Decisiveness: avg captures=16.8, avg pawn moves=13.6
Early repetition count (<30 ply): 0
Avg repetition ply: 0.0
Timing (Hard): avg=797.7ms, max=1043.3ms, timeouts=5
Timing (Max): avg=3003.9ms, max=3031.8ms, timeouts=0

Max as White vs Hard: 3-2-0 (5 games)
Avg plies: 138.2
End reasons: mate=3, stalemate=0, repetition=1, 50-move=0, other=1
Repetition rate: 20.0% | Mate rate: 60.0%
Decisiveness: avg captures=20.6, avg pawn moves=14.8
Early repetition count (<30 ply): 0
Avg repetition ply: 183.0
Timing (Hard): avg=790.4ms, max=1053.2ms, timeouts=5
Timing (Max): avg=3012.0ms, max=3363.0ms, timeouts=10

Notes:
- Deterministic base seed used; move-level seeds derived from a fixed RNG.
- Opening suite: fixed UCI sequences applied before engine play; selection is seed-based.
- FEN suite: FENs are derived from curated UCI sequences and selected by seed.
- Early repetition rerolls are counted in repetition diagnostics but not in W/D/L totals.
- Decisiveness metrics (captures/pawn moves) include opening or FEN start moves.
- Segment W/D/L lines are reported from Hard's perspective.
- SAN generation uses engine move legality; if SAN is missing for any move, check meta JSON.

<!-- REPORT:END -->
