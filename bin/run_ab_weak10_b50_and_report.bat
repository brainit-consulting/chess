@echo off
REM ============================================================
REM Scorpion Chess - Run weak10 b50 ladder and report
REM ============================================================

cd /d H:\chess

set RUN_ID=max15s_sf_ladder_weak10_b50
set OUT_DIR=H:\chess\benchmarks\baseline\%RUN_ID%
set STOCKFISH=H:\chess\bin\stockfish-windows-x86-64-avx2.exe
if not exist "%STOCKFISH%" set STOCKFISH=H:\chess\bin\ScorpionHeart.exe

node --import tsx scripts\bench\quickVsStockfish.ts ^
  --stockfish "%STOCKFISH%" ^
  --reset ^
  --mode max ^
  --movetime 15000 ^
  --sf-ladder "5,10,20,40,80" ^
  --games 50 ^
  --fenSuite ^
  --threads 1 ^
  --hash 128 ^
  --max-plies 200 ^
  --seed 7000 ^
  --runId %RUN_ID% ^
  --outDir "%OUT_DIR%"

for /f "delims=" %%H in ('git rev-parse HEAD') do set BASELINE=%%H

bin\run_benchmark_report.bat --run %RUN_ID% --pgn-dir "%OUT_DIR%" --engine Scorpion --baseline %BASELINE% --time-control max15s --opponent "Stockfish ladder weak10"

pause
