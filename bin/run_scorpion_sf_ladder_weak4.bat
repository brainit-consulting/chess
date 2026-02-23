@echo off
REM ============================================================
REM Scorpion Chess - Stockfish Time Ladder (Weak4, 10 games)
REM Mode: MaxThinking
REM Purpose: Quick sanity check vs very weak Stockfish (2/4/8/16ms).
REM ============================================================

cd /d H:\chess

echo Starting Scorpion MaxThinking vs weak4 Stockfish ladder...
echo.

set STOCKFISH_EXE=H:\chess\bin\stockfish-windows-x86-64-avx2.exe
if not exist "%STOCKFISH_EXE%" set STOCKFISH_EXE=H:\chess\bin\ScorpionHeart.exe

node --import tsx scripts/bench/quickVsStockfish.ts ^
  --stockfish "%STOCKFISH_EXE%" ^
  --reset ^
  --mode max ^
  --movetime 15000 ^
  --sf-ladder "2,4,8,16" ^
  --games 10 ^
  --fenSuite ^
  --threads 1 ^
  --hash 128 ^
  --max-plies 200 ^
  --seed 7000 ^
  --runId max15s_sf_ladder_weak4 ^
  --outDir "H:\chess\benchmarks\baseline\max15s_sf_ladder_weak4"

echo.
echo Ladder run finished.
pause
