# Scorpion Self-Play Report

Latest run summary is always inside the markers below.

<!-- REPORT:START -->
Last updated: 2026-03-24T00:22:50.940Z (UTC) | 2026-03-23 20:22:50 ET
Config: hardMs=1000, maxMs=5000, batch=5, swap=true, fenSuite=true
Commit: 61408f583328b2a5350605afe9318fc3c30cf29d
Base seed: 9050
Output: H:\chess\benchmarks\selfplay\run-phase5g-se-depth1-seed9050
Cumulative: 3-7-0 (10 games)
Avg plies per game: 116.4
End reasons: mate=3, stalemate=0, repetition=6, 50-move=0, other=1
Repetition rate: 60.0% | Mate rate: 30.0%
Decisiveness: avg captures=19.1, avg pawn moves=13.2
Early repetition count (<30 ply): 0
Avg repetition ply: 124.5
Timing (Hard): avg=923.7ms, max=1239.1ms, timeouts=1
Timing (Max): avg=4764.9ms, max=5059.9ms, timeouts=0

Hard as White vs Max: 1-4-0 (5 games)
Avg plies: 110.6
End reasons: mate=1, stalemate=0, repetition=3, 50-move=0, other=1
Repetition rate: 60.0% | Mate rate: 20.0%
Decisiveness: avg captures=17.4, avg pawn moves=11.6
Early repetition count (<30 ply): 0
Avg repetition ply: 97.3
Timing (Hard): avg=924.1ms, max=1239.1ms, timeouts=1
Timing (Max): avg=4776.2ms, max=5059.9ms, timeouts=0

Max as White vs Hard: 2-3-0 (5 games)
Avg plies: 122.2
End reasons: mate=2, stalemate=0, repetition=3, 50-move=0, other=0
Repetition rate: 60.0% | Mate rate: 40.0%
Decisiveness: avg captures=20.8, avg pawn moves=14.8
Early repetition count (<30 ply): 0
Avg repetition ply: 151.7
Timing (Hard): avg=923.3ms, max=965.1ms, timeouts=0
Timing (Max): avg=4754.7ms, max=4997.3ms, timeouts=0

Notes:
- Deterministic base seed used; move-level seeds derived from a fixed RNG.
- Opening suite: fixed UCI sequences applied before engine play; selection is seed-based.
- FEN suite: FENs are derived from curated UCI sequences and selected by seed.
- Early repetition rerolls are counted in repetition diagnostics but not in W/D/L totals.
- Decisiveness metrics (captures/pawn moves) include opening or FEN start moves.
- Segment W/D/L lines are reported from Hard's perspective.
- SAN generation uses engine move legality; if SAN is missing for any move, check meta JSON.

<!-- REPORT:END -->
