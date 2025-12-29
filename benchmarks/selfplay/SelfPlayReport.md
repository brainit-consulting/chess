# Scorpion Self-Play Report

Latest run summary is always inside the markers below.

<!-- REPORT:START -->
Last updated: 2025-12-29T02:56:07.670Z
Config: hardMs=800, maxMs=10000, batch=5, swap=true, fenSuite=true
Commit: 83560ee5a30d44f29f9d3a7e99d688065d48d298
Base seed: 1000
Output: H:\chess\benchmarks\selfplay\run-chunk2-10000ms
Cumulative: 1-7-2 (10 games)
Avg plies per game: 121.2
End reasons: mate=3, stalemate=0, repetition=5, 50-move=0, other=2
Repetition rate: 50.0% | Mate rate: 30.0%
Decisiveness: avg captures=20.5, avg pawn moves=20.2
Early repetition count (<30 ply): 1
Avg repetition ply: 74.5
Timing (Hard): avg=764.3ms, max=987.6ms, timeouts=125
Timing (Max): avg=9619.2ms, max=10126.5ms, timeouts=128

Hard as White vs Max: 1-4-0 (5 games)
Avg plies: 124.2
End reasons: mate=1, stalemate=0, repetition=3, 50-move=0, other=1
Repetition rate: 60.0% | Mate rate: 20.0%
Decisiveness: avg captures=20.8, avg pawn moves=24.2
Early repetition count (<30 ply): 1
Avg repetition ply: 65.3
Timing (Hard): avg=765.9ms, max=987.6ms, timeouts=87
Timing (Max): avg=9634.7ms, max=10126.5ms, timeouts=86

Max as White vs Hard: 0-3-2 (5 games)
Avg plies: 118.2
End reasons: mate=2, stalemate=0, repetition=2, 50-move=0, other=1
Repetition rate: 40.0% | Mate rate: 40.0%
Decisiveness: avg captures=20.2, avg pawn moves=16.2
Early repetition count (<30 ply): 0
Avg repetition ply: 93.0
Timing (Hard): avg=762.6ms, max=897.3ms, timeouts=38
Timing (Max): avg=9603.0ms, max=10098.2ms, timeouts=42

Notes:
- Deterministic base seed used; move-level seeds derived from a fixed RNG.
- Opening suite: fixed UCI sequences applied before engine play; selection is seed-based.
- FEN suite: FENs are derived from curated UCI sequences and selected by seed.
- Early repetition rerolls are counted in repetition diagnostics but not in W/D/L totals.
- Decisiveness metrics (captures/pawn moves) include opening or FEN start moves.
- Segment W/D/L lines are reported from Hard's perspective.
- SAN generation uses engine move legality; if SAN is missing for any move, check meta JSON.

<!-- REPORT:END -->
