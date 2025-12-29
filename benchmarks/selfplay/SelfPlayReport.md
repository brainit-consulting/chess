# Scorpion Self-Play Report

Latest run summary is always inside the markers below.

<!-- REPORT:START -->
Last updated: 2025-12-29T00:56:06.149Z
Config: hardMs=800, maxMs=10000, batch=5, swap=true, fenSuite=true
Commit: 928758c0f3799bae3bc05be4689286bff74622fa
Base seed: 1000
Output: H:\chess\benchmarks\selfplay\run-chunk1-10000ms
Cumulative: 2-8-0 (10 games)
Avg plies per game: 101.6
End reasons: mate=2, stalemate=0, repetition=7, 50-move=0, other=1
Repetition rate: 70.0% | Mate rate: 20.0%
Decisiveness: avg captures=16.5, avg pawn moves=22.9
Early repetition count (<30 ply): 4
Avg repetition ply: 63.8
Timing (Hard): avg=774.6ms, max=900.7ms, timeouts=185
Timing (Max): avg=9562.8ms, max=10099.7ms, timeouts=185

Hard as White vs Max: 2-3-0 (5 games)
Avg plies: 72.2
End reasons: mate=2, stalemate=0, repetition=3, 50-move=0, other=0
Repetition rate: 60.0% | Mate rate: 40.0%
Decisiveness: avg captures=12.8, avg pawn moves=21.8
Early repetition count (<30 ply): 3
Avg repetition ply: 38.0
Timing (Hard): avg=838.0ms, max=898.3ms, timeouts=108
Timing (Max): avg=10002.6ms, max=10099.7ms, timeouts=104

Max as White vs Hard: 0-5-0 (5 games)
Avg plies: 131.0
End reasons: mate=0, stalemate=0, repetition=4, 50-move=0, other=1
Repetition rate: 80.0% | Mate rate: 0.0%
Decisiveness: avg captures=20.2, avg pawn moves=24.0
Early repetition count (<30 ply): 1
Avg repetition ply: 94.8
Timing (Hard): avg=739.1ms, max=900.7ms, timeouts=77
Timing (Max): avg=9324.2ms, max=10098.8ms, timeouts=81

Notes:
- Deterministic base seed used; move-level seeds derived from a fixed RNG.
- Opening suite: fixed UCI sequences applied before engine play; selection is seed-based.
- FEN suite: FENs are derived from curated UCI sequences and selected by seed.
- Early repetition rerolls are counted in repetition diagnostics but not in W/D/L totals.
- Decisiveness metrics (captures/pawn moves) include opening or FEN start moves.
- Segment W/D/L lines are reported from Hard's perspective.
- SAN generation uses engine move legality; if SAN is missing for any move, check meta JSON.

<!-- REPORT:END -->
