@echo off
REM ============================================================
REM Scorpion Chess - Stockfish Time Ladder (Weak, 6 games, swap)
REM Mode: MaxThinking
REM Purpose: Quick sanity check vs very weak Stockfish (swapped colors).
REM ============================================================

cd /d H:\chess

echo Starting Scorpion MaxThinking vs weak Stockfish ladder (swap)...
echo.

node --import tsx scripts/bench/quickVsStockfish.ts ^
  --stockfish H:\chess\bin\ScorpionHeart.exe ^
  --reset ^
  --mode max ^
  --movetime 15000 ^
  --sf-ladder "5,10,20,40,80" ^
  --games 6 ^
  --swap ^
  --fenSuite ^
  --threads 1 ^
  --hash 128 ^
  --max-plies 200 ^
  --seed 7000 ^
  --runId max15s_sf_ladder_weak6_swap ^
  --outDir "H:\chess\benchmarks\baseline\max15s_sf_ladder_weak6_swap"

echo.
echo Ladder run finished.
pause
