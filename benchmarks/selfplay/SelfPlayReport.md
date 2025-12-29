# Scorpion Self-Play Report

Latest run summary is always inside the markers below.

<!-- REPORT:START -->
Last updated: 2025-12-29T13:44:55.643Z
Config: hardMs=800, maxMs=10000, batch=5, swap=true, fenSuite=true
Commit: 032685e356aa2983665247a92554cb291ba2614c
Base seed: 2000
Output: H:\chess\benchmarks\selfplay\run-chunk3-10000ms
Cumulative: 2-7-1 (10 games)
Avg plies per game: 94.3
End reasons: mate=3, stalemate=0, repetition=6, 50-move=0, other=1
Repetition rate: 60.0% | Mate rate: 30.0%
Decisiveness: avg captures=16.9, avg pawn moves=20.4
Early repetition count (<30 ply): 2
Avg repetition ply: 72.0
Timing (Hard): avg=794.5ms, max=899.5ms, timeouts=109
Timing (Max): avg=9984.2ms, max=10098.0ms, timeouts=111

Hard as White vs Max: 1-3-1 (5 games)
Avg plies: 61.0
End reasons: mate=2, stalemate=0, repetition=3, 50-move=0, other=0
Repetition rate: 60.0% | Mate rate: 40.0%
Decisiveness: avg captures=13.8, avg pawn moves=11.8
Early repetition count (<30 ply): 1
Avg repetition ply: 49.8
Timing (Hard): avg=806.9ms, max=897.3ms, timeouts=44
Timing (Max): avg=9998.8ms, max=10097.8ms, timeouts=42

Max as White vs Hard: 1-4-0 (5 games)
Avg plies: 127.6
End reasons: mate=1, stalemate=0, repetition=3, 50-move=0, other=1
Repetition rate: 60.0% | Mate rate: 20.0%
Decisiveness: avg captures=20.0, avg pawn moves=29.0
Early repetition count (<30 ply): 1
Avg repetition ply: 94.3
Timing (Hard): avg=788.5ms, max=899.5ms, timeouts=65
Timing (Max): avg=9977.3ms, max=10098.0ms, timeouts=69

Notes:
- Deterministic base seed used; move-level seeds derived from a fixed RNG.
- Opening suite: fixed UCI sequences applied before engine play; selection is seed-based.
- FEN suite: FENs are derived from curated UCI sequences and selected by seed.
- Early repetition rerolls are counted in repetition diagnostics but not in W/D/L totals.
- Decisiveness metrics (captures/pawn moves) include opening or FEN start moves.
- Segment W/D/L lines are reported from Hard's perspective.
- SAN generation uses engine move legality; if SAN is missing for any move, check meta JSON.

<!-- REPORT:END -->
