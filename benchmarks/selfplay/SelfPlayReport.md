# Scorpion Self-Play Report

Latest run summary is always inside the markers below.

<!-- REPORT:START -->
Last updated: 2026-03-07T14:36:08.735Z (UTC) | 2026-03-07 09:36:08 ET
Config: hardMs=1000, maxMs=3000, batch=5, swap=true, fenSuite=true
Commit: 8988a2d0157addbacf05325c3d2e90752cb5a7ee
Base seed: 9029
Output: H:\chess\benchmarks\selfplay\run-se-seed9029
Cumulative: 4-6-0 (10 games)
Avg plies per game: 105.6
End reasons: mate=4, stalemate=0, repetition=4, 50-move=0, other=2
Repetition rate: 40.0% | Mate rate: 40.0%
Decisiveness: avg captures=17.6, avg pawn moves=11.5
Early repetition count (<30 ply): 0
Avg repetition ply: 119.0
Timing (Hard): avg=931.8ms, max=1101.8ms, timeouts=1
Timing (Max): avg=2858.3ms, max=3113.6ms, timeouts=1

Hard as White vs Max: 4-1-0 (5 games)
Avg plies: 76.0
End reasons: mate=4, stalemate=0, repetition=0, 50-move=0, other=1
Repetition rate: 0.0% | Mate rate: 80.0%
Decisiveness: avg captures=13.4, avg pawn moves=7.0
Early repetition count (<30 ply): 0
Avg repetition ply: 0.0
Timing (Hard): avg=940.5ms, max=1101.8ms, timeouts=1
Timing (Max): avg=2877.6ms, max=3113.6ms, timeouts=1

Max as White vs Hard: 0-5-0 (5 games)
Avg plies: 135.2
End reasons: mate=0, stalemate=0, repetition=4, 50-move=0, other=1
Repetition rate: 80.0% | Mate rate: 0.0%
Decisiveness: avg captures=21.8, avg pawn moves=16.0
Early repetition count (<30 ply): 0
Avg repetition ply: 119.0
Timing (Hard): avg=927.0ms, max=964.9ms, timeouts=0
Timing (Max): avg=2847.6ms, max=3088.3ms, timeouts=0

Notes:
- Deterministic base seed used; move-level seeds derived from a fixed RNG.
- Opening suite: fixed UCI sequences applied before engine play; selection is seed-based.
- FEN suite: FENs are derived from curated UCI sequences and selected by seed.
- Early repetition rerolls are counted in repetition diagnostics but not in W/D/L totals.
- Decisiveness metrics (captures/pawn moves) include opening or FEN start moves.
- Segment W/D/L lines are reported from Hard's perspective.
- SAN generation uses engine move legality; if SAN is missing for any move, check meta JSON.

<!-- REPORT:END -->
