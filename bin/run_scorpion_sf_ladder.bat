@echo off
REM ============================================================
REM Scorpion Chess – Stockfish Time Ladder (Find Similar Strength)
REM Mode: MaxThinking
REM Purpose: Sweep Stockfish movetimes to find ~50% score point.
REM ============================================================

cd /d H:\chess

echo Starting Scorpion MaxThinking vs Stockfish ladder...
echo.

node --import tsx scripts/bench/quickVsStockfish.ts ^
  --stockfish H:\chess\bin\ScorpionHeart.exe ^
  --reset ^
  --mode max ^
  --movetime 15000 ^
  --sf-ladder "3000,5000,8000,12000,15000,20000" ^
  --games 80 ^
  --swap ^
  --fenSuite ^
  --threads 1 ^
  --hash 128 ^
  --max-plies 200 ^
  --seed 7000 ^
  --runId max15s_sf_ladder ^
  --outDir "H:\chess\benchmarks\baseline\max15s_sf_ladder"

echo.
echo Ladder run finished.
pause
