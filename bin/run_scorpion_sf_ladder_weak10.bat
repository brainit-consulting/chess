@echo off
REM ============================================================
REM Scorpion Chess - Stockfish Time Ladder (Weak, 10 games)
REM Mode: MaxThinking
REM Purpose: Quick sanity check vs very weak Stockfish.
REM ============================================================

cd /d H:\chess

echo Starting Scorpion MaxThinking vs weak Stockfish ladder...
echo.

set STOCKFISH_EXE=H:\chess\bin\stockfish-windows-x86-64-avx2.exe
if not exist "%STOCKFISH_EXE%" set STOCKFISH_EXE=H:\chess\bin\ScorpionHeart.exe

node --import tsx scripts/bench/quickVsStockfish.ts ^
  --stockfish "%STOCKFISH_EXE%" ^
  --reset ^
  --mode max ^
  --movetime 15000 ^
  --sf-ladder "5,10,20,40,80" ^
  --games 10 ^
  --fenSuite ^
  --threads 1 ^
  --hash 128 ^
  --max-plies 200 ^
  --seed 7000 ^
  --runId max15s_sf_ladder_weak10 ^
  --outDir "H:\chess\benchmarks\baseline\max15s_sf_ladder_weak10"

echo.
echo Ladder run finished.
pause
