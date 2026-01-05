# Scorpion Self-Play Report

Latest run summary is always inside the markers below.

<!-- REPORT:START -->
Last updated: 2026-01-05T03:05:01.463Z (UTC) | 2026-01-04 22:05:01 ET
Config: hardMs=1500, maxMs=1500, batch=2, swap=true, fenSuite=true
Commit: 5a30c442f0b33e57cd495abf46dbccfbf7d1beb1
Base seed: 8003
Output: H:\chess-antiperp\benchmarks\selfplay\run-fastgate-v1.1.67-antirepchecks-s8003
Cumulative: 0-3-1 (4 games)
Avg plies per game: 71.5
End reasons: mate=1, stalemate=0, repetition=3, 50-move=0, other=0
Repetition rate: 75.0% | Mate rate: 25.0%
Decisiveness: avg captures=16.0, avg pawn moves=9.8
Early repetition count (<30 ply): 0
Avg repetition ply: 71.3
Timing (Hard): avg=1404.7ms, max=1514.4ms, timeouts=0
Timing (Max): avg=0.0ms, max=0.0ms, timeouts=0

Hard as White vs Max: 0-3-1 (4 games)
Avg plies: 71.5
End reasons: mate=1, stalemate=0, repetition=3, 50-move=0, other=0
Repetition rate: 75.0% | Mate rate: 25.0%
Decisiveness: avg captures=16.0, avg pawn moves=9.8
Early repetition count (<30 ply): 0
Avg repetition ply: 71.3
Timing (Hard): avg=1404.7ms, max=1514.4ms, timeouts=0
Timing (Max): avg=0.0ms, max=0.0ms, timeouts=0

Max as White vs Hard: 0-0-0 (0 games)
Avg plies: 0.0
End reasons: mate=0, stalemate=0, repetition=0, 50-move=0, other=0
Repetition rate: 0.0% | Mate rate: 0.0%
Decisiveness: avg captures=0.0, avg pawn moves=0.0
Early repetition count (<30 ply): 0
Avg repetition ply: 0.0
Timing (Hard): avg=0.0ms, max=0.0ms, timeouts=0
Timing (Max): avg=0.0ms, max=0.0ms, timeouts=0

Notes:
- Deterministic base seed used; move-level seeds derived from a fixed RNG.
- Opening suite: fixed UCI sequences applied before engine play; selection is seed-based.
- FEN suite: FENs are derived from curated UCI sequences and selected by seed.
- Early repetition rerolls are counted in repetition diagnostics but not in W/D/L totals.
- Decisiveness metrics (captures/pawn moves) include opening or FEN start moves.
- Segment W/D/L lines are reported from Hard's perspective.
- SAN generation uses engine move legality; if SAN is missing for any move, check meta JSON.

<!-- REPORT:END -->
