# Scorpion Self-Play Report

Latest run summary is always inside the markers below.

<!-- REPORT:START -->
Last updated: 2026-03-24T23:13:41.110Z (UTC) | 2026-03-24 19:13:41 ET
Config: hardMs=1000, maxMs=5000, batch=5, swap=true, fenSuite=true
Commit: 44a75d024966fe956e91b1fb54e812bca2acda58
Base seed: 9051
Output: H:\chess\benchmarks\selfplay\run-phase5h-iid-depth3-seed9051
Cumulative: 5-5-0 (10 games)
Avg plies per game: 111.6
End reasons: mate=5, stalemate=0, repetition=5, 50-move=0, other=0
Repetition rate: 50.0% | Mate rate: 50.0%
Decisiveness: avg captures=19.3, avg pawn moves=14.0
Early repetition count (<30 ply): 0
Avg repetition ply: 138.8
Timing (Hard): avg=955.3ms, max=1272.8ms, timeouts=15
Timing (Max): avg=4827.8ms, max=5371.1ms, timeouts=42

Hard as White vs Max: 4-1-0 (5 games)
Avg plies: 95.4
End reasons: mate=4, stalemate=0, repetition=1, 50-move=0, other=0
Repetition rate: 20.0% | Mate rate: 80.0%
Decisiveness: avg captures=17.6, avg pawn moves=9.4
Early repetition count (<30 ply): 0
Avg repetition ply: 189.0
Timing (Hard): avg=962.4ms, max=1272.8ms, timeouts=12
Timing (Max): avg=4859.3ms, max=5371.1ms, timeouts=24

Max as White vs Hard: 1-4-0 (5 games)
Avg plies: 127.8
End reasons: mate=1, stalemate=0, repetition=4, 50-move=0, other=0
Repetition rate: 80.0% | Mate rate: 20.0%
Decisiveness: avg captures=21.0, avg pawn moves=18.6
Early repetition count (<30 ply): 0
Avg repetition ply: 126.3
Timing (Hard): avg=949.9ms, max=1255.0ms, timeouts=3
Timing (Max): avg=4804.5ms, max=5354.8ms, timeouts=18

Notes:
- Deterministic base seed used; move-level seeds derived from a fixed RNG.
- Opening suite: fixed UCI sequences applied before engine play; selection is seed-based.
- FEN suite: FENs are derived from curated UCI sequences and selected by seed.
- Early repetition rerolls are counted in repetition diagnostics but not in W/D/L totals.
- Decisiveness metrics (captures/pawn moves) include opening or FEN start moves.
- Segment W/D/L lines are reported from Hard's perspective.
- SAN generation uses engine move legality; if SAN is missing for any move, check meta JSON.

<!-- REPORT:END -->
