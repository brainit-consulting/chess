# Scorpion Self-Play Report

Latest run summary is always inside the markers below.

<!-- REPORT:START -->
Last updated: 2026-02-25T16:49:00.282Z (UTC) | 2026-02-25 11:49:00 ET
Config: hardMs=1000, maxMs=3000, batch=5, swap=true, fenSuite=true
Commit: 71e4d5dc5b36f8397def8a01c8a58f8cfadfc7d4
Base seed: 9007
Output: H:\chess\benchmarks\selfplay\run-phase2e-king-passed-proximity
Cumulative: 4-6-0 (10 games)
Avg plies per game: 83.4
End reasons: mate=4, stalemate=0, repetition=6, 50-move=0, other=0
Repetition rate: 60.0% | Mate rate: 40.0%
Decisiveness: avg captures=16.1, avg pawn moves=12.9
Early repetition count (<30 ply): 0
Avg repetition ply: 110.3
Timing (Hard): avg=942.6ms, max=1098.0ms, timeouts=1
Timing (Max): avg=2846.4ms, max=3035.4ms, timeouts=0

Hard as White vs Max: 2-3-0 (5 games)
Avg plies: 89.0
End reasons: mate=2, stalemate=0, repetition=3, 50-move=0, other=0
Repetition rate: 60.0% | Mate rate: 40.0%
Decisiveness: avg captures=17.6, avg pawn moves=14.6
Early repetition count (<30 ply): 0
Avg repetition ply: 123.0
Timing (Hard): avg=944.2ms, max=1098.0ms, timeouts=1
Timing (Max): avg=2843.3ms, max=3010.3ms, timeouts=0

Max as White vs Hard: 2-3-0 (5 games)
Avg plies: 77.8
End reasons: mate=2, stalemate=0, repetition=3, 50-move=0, other=0
Repetition rate: 60.0% | Mate rate: 40.0%
Decisiveness: avg captures=14.6, avg pawn moves=11.2
Early repetition count (<30 ply): 0
Avg repetition ply: 97.7
Timing (Hard): avg=940.8ms, max=963.9ms, timeouts=0
Timing (Max): avg=2849.9ms, max=3035.4ms, timeouts=0

Notes:
- Deterministic base seed used; move-level seeds derived from a fixed RNG.
- Opening suite: fixed UCI sequences applied before engine play; selection is seed-based.
- FEN suite: FENs are derived from curated UCI sequences and selected by seed.
- Early repetition rerolls are counted in repetition diagnostics but not in W/D/L totals.
- Decisiveness metrics (captures/pawn moves) include opening or FEN start moves.
- Segment W/D/L lines are reported from Hard's perspective.
- SAN generation uses engine move legality; if SAN is missing for any move, check meta JSON.

<!-- REPORT:END -->
