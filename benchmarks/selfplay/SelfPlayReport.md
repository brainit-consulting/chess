# Scorpion Self-Play Report

Latest run summary is always inside the markers below.

<!-- REPORT:START -->
Last updated: 2026-02-26T18:13:15.543Z (UTC) | 2026-02-26 13:13:15 ET
Config: hardMs=1000, maxMs=3000, batch=5, swap=true, fenSuite=true
Commit: 2802ca235ad2c8107c300c8c00640c6b37d015fb
Base seed: 9011
Output: H:\chess\benchmarks\selfplay\run-phase2g-lone-king-mating
Cumulative: 3-7-0 (10 games)
Avg plies per game: 128.4
End reasons: mate=3, stalemate=0, repetition=4, 50-move=0, other=3
Repetition rate: 40.0% | Mate rate: 30.0%
Decisiveness: avg captures=20.5, avg pawn moves=15.4
Early repetition count (<30 ply): 0
Avg repetition ply: 125.5
Timing (Hard): avg=913.5ms, max=1099.2ms, timeouts=1
Timing (Max): avg=2849.6ms, max=3098.5ms, timeouts=1

Hard as White vs Max: 2-3-0 (5 games)
Avg plies: 109.4
End reasons: mate=2, stalemate=0, repetition=2, 50-move=0, other=1
Repetition rate: 40.0% | Mate rate: 40.0%
Decisiveness: avg captures=16.0, avg pawn moves=13.2
Early repetition count (<30 ply): 0
Avg repetition ply: 128.5
Timing (Hard): avg=919.8ms, max=1099.2ms, timeouts=1
Timing (Max): avg=2854.2ms, max=3080.1ms, timeouts=0

Max as White vs Hard: 1-4-0 (5 games)
Avg plies: 147.4
End reasons: mate=1, stalemate=0, repetition=2, 50-move=0, other=2
Repetition rate: 40.0% | Mate rate: 20.0%
Decisiveness: avg captures=25.0, avg pawn moves=17.6
Early repetition count (<30 ply): 0
Avg repetition ply: 122.5
Timing (Hard): avg=908.7ms, max=956.1ms, timeouts=0
Timing (Max): avg=2846.1ms, max=3098.5ms, timeouts=1

Notes:
- Deterministic base seed used; move-level seeds derived from a fixed RNG.
- Opening suite: fixed UCI sequences applied before engine play; selection is seed-based.
- FEN suite: FENs are derived from curated UCI sequences and selected by seed.
- Early repetition rerolls are counted in repetition diagnostics but not in W/D/L totals.
- Decisiveness metrics (captures/pawn moves) include opening or FEN start moves.
- Segment W/D/L lines are reported from Hard's perspective.
- SAN generation uses engine move legality; if SAN is missing for any move, check meta JSON.

<!-- REPORT:END -->
