@echo off
REM ============================================================
REM Scorpion Chess – Baseline Match (After Ladder)
REM Mode: MaxThinking
REM Purpose: Run many games at the matched Stockfish movetime to
REM          estimate a stable baseline (W/D/L + Elo delta).
REM ============================================================
REM IMPORTANT:
REM - Edit STOCKFISH_MOVETIME_MS below after the ladder run.
REM - Choose the ladder step where Scorpion is closest to ~50%.
REM ============================================================

set STOCKFISH_MOVETIME_MS=12000

cd /d H:\chess

echo Starting Scorpion MaxThinking baseline vs Stockfish...
echo Scorpion movetime: 15000 ms
echo Stockfish movetime: %STOCKFISH_MOVETIME_MS% ms
echo.

node --import tsx scripts/bench/quickVsStockfish.ts ^
  --stockfish H:\chess\bin\ScorpionHeart.exe ^
  --reset ^
  --mode max ^
  --movetime 15000 ^
  --stockfishMovetime %STOCKFISH_MOVETIME_MS% ^
  --games 600 ^
  --swap ^
  --fenSuite ^
  --threads 1 ^
  --hash 128 ^
  --max-plies 200 ^
  --seed 8000 ^
  --runId baseline_max15s_vs_sf%STOCKFISH_MOVETIME_MS% ^
  --outDir "H:\chess\benchmarks\baseline\baseline_max15s_vs_sf%STOCKFISH_MOVETIME_MS%"

echo.
echo Baseline run finished.
pause
