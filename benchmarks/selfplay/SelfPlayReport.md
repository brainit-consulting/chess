# Scorpion Self-Play Report

Latest run summary is always inside the markers below.

<!-- REPORT:START -->
Last updated: 2025-12-28T19:48:20.020Z
Config: hardMs=800, maxMs=2000, batch=10, swap=true
Commit: 84a1520258c79d6447b639be85020063b9911d5a
Base seed: 1000
Output: H:\chess\benchmarks\selfplay\run-20251228-144230
Cumulative: 0-20-0 (20 games)
Avg plies per game: 17.8
End reasons: mate=0, stalemate=0, repetition=20, 50-move=0, other=0
Repetition rate: 100.0%
Timing (Hard): avg=887.0ms, max=899.3ms, timeouts=120
Timing (Max): avg=2087.0ms, max=2098.3ms, timeouts=116

Hard as White vs Max: 0-10-0 (10 games)
Avg plies: 17.6
End reasons: mate=0, stalemate=0, repetition=10, 50-move=0, other=0
Repetition rate: 100.0%
Timing (Hard): avg=887.9ms, max=895.9ms, timeouts=60
Timing (Max): avg=2088.4ms, max=2096.6ms, timeouts=56

Max as White vs Hard: 0-10-0 (10 games)
Avg plies: 18.0
End reasons: mate=0, stalemate=0, repetition=10, 50-move=0, other=0
Repetition rate: 100.0%
Timing (Hard): avg=886.1ms, max=899.3ms, timeouts=60
Timing (Max): avg=2085.6ms, max=2098.3ms, timeouts=60

Notes:
- Deterministic base seed used; move-level seeds derived from a fixed RNG.
- Opening suite: fixed UCI sequences applied before engine play; selection is seed-based.
- SAN generation uses engine move legality; if SAN is missing for any move, check meta JSON.

<!-- REPORT:END -->
