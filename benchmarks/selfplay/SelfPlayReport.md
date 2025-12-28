# Scorpion Self-Play Report

Latest run summary is always inside the markers below.

<!-- REPORT:START -->
Last updated: 2025-12-28T22:02:18.591Z
Config: hardMs=800, maxMs=2000, batch=10, swap=true, fenSuite=true
Commit: bb8e3589214c24de67e224968c45d5e4c1e97769
Base seed: 1000
Output: H:\chess\benchmarks\selfplay\run-20251228-162509
Cumulative: 2-18-0 (20 games)
Avg plies per game: 63.8
End reasons: mate=2, stalemate=0, repetition=18, 50-move=0, other=0
Repetition rate: 90.0%
Early repetition count (<30 ply): 12
Avg repetition ply: 43.8
Timing (Hard): avg=856.0ms, max=903.5ms, timeouts=486
Timing (Max): avg=2067.3ms, max=2099.5ms, timeouts=486

Hard as White vs Max: 1-9-0 (10 games)
Avg plies: 57.1
End reasons: mate=1, stalemate=0, repetition=9, 50-move=0, other=0
Repetition rate: 90.0%
Early repetition count (<30 ply): 4
Avg repetition ply: 41.8
Timing (Hard): avg=871.9ms, max=903.5ms, timeouts=238
Timing (Max): avg=2073.4ms, max=2099.5ms, timeouts=229

Max as White vs Hard: 1-9-0 (10 games)
Avg plies: 70.5
End reasons: mate=1, stalemate=0, repetition=9, 50-move=0, other=0
Repetition rate: 90.0%
Early repetition count (<30 ply): 8
Avg repetition ply: 45.2
Timing (Hard): avg=842.8ms, max=897.3ms, timeouts=248
Timing (Max): avg=2062.6ms, max=2097.2ms, timeouts=257

Notes:
- Deterministic base seed used; move-level seeds derived from a fixed RNG.
- Opening suite: fixed UCI sequences applied before engine play; selection is seed-based.
- FEN suite: FENs are derived from curated UCI sequences and selected by seed.
- Early repetition rerolls are counted in repetition diagnostics but not in W/D/L totals.
- Segment W/D/L lines are reported from Hard's perspective.
- SAN generation uses engine move legality; if SAN is missing for any move, check meta JSON.

<!-- REPORT:END -->
