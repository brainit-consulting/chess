# Scorpion Self-Play Report

Latest run summary is always inside the markers below.

<!-- REPORT:START -->
Last updated: 2026-03-23T20:02:16.434Z (UTC) | 2026-03-23 16:02:16 ET
Config: hardMs=1000, maxMs=5000, batch=5, swap=true, fenSuite=true
Commit: a8b6decfc3abcdbb0560bade9bf30cef4ebe872b
Base seed: 9049
Output: H:\chess\benchmarks\selfplay\run-phase5f-se-depth2-seed9049
Cumulative: 4-6-0 (10 games)
Avg plies per game: 116.3
End reasons: mate=4, stalemate=0, repetition=3, 50-move=0, other=3
Repetition rate: 30.0% | Mate rate: 40.0%
Decisiveness: avg captures=17.5, avg pawn moves=15.1
Early repetition count (<30 ply): 1
Avg repetition ply: 110.0
Timing (Hard): avg=927.4ms, max=1256.9ms, timeouts=1
Timing (Max): avg=4769.6ms, max=5104.3ms, timeouts=1

Hard as White vs Max: 3-2-0 (5 games)
Avg plies: 93.2
End reasons: mate=3, stalemate=0, repetition=2, 50-move=0, other=0
Repetition rate: 40.0% | Mate rate: 60.0%
Decisiveness: avg captures=15.2, avg pawn moves=15.0
Early repetition count (<30 ply): 1
Avg repetition ply: 117.7
Timing (Hard): avg=912.3ms, max=1256.9ms, timeouts=1
Timing (Max): avg=4776.5ms, max=5104.3ms, timeouts=1

Max as White vs Hard: 1-4-0 (5 games)
Avg plies: 139.4
End reasons: mate=1, stalemate=0, repetition=1, 50-move=0, other=3
Repetition rate: 20.0% | Mate rate: 20.0%
Decisiveness: avg captures=19.8, avg pawn moves=15.2
Early repetition count (<30 ply): 0
Avg repetition ply: 87.0
Timing (Hard): avg=937.6ms, max=970.8ms, timeouts=0
Timing (Max): avg=4765.1ms, max=5014.4ms, timeouts=0

Notes:
- Deterministic base seed used; move-level seeds derived from a fixed RNG.
- Opening suite: fixed UCI sequences applied before engine play; selection is seed-based.
- FEN suite: FENs are derived from curated UCI sequences and selected by seed.
- Early repetition rerolls are counted in repetition diagnostics but not in W/D/L totals.
- Decisiveness metrics (captures/pawn moves) include opening or FEN start moves.
- Segment W/D/L lines are reported from Hard's perspective.
- SAN generation uses engine move legality; if SAN is missing for any move, check meta JSON.

<!-- REPORT:END -->
