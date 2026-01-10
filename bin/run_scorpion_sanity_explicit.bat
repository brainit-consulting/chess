@echo off
REM ============================================================
REM Scorpion Chess – Sanity Check vs Stockfish
REM Mode: MaxThinking
REM Games: 4 (hard stop)
REM Explicit paths + reset + isolated output
REM ============================================================

cd /d H:\chess

echo Starting Scorpion MaxThinking SANITY check...
echo.

node --import tsx scripts/bench/quickVsStockfish.ts ^
  --stockfish H:\chess\bin\ScorpionHeart.exe ^
  --reset ^
  --mode max ^
  --movetime 15000 ^
  --stockfishMovetime 5000 ^
  --games 4 ^
  --swap ^
  --fenSuite ^
  --seed 6001 ^
  --runId sanity_check_max15s ^
  --outDir "H:\chess\benchmarks\sanity\sanity_check_max15s"

echo.
echo Sanity check finished.
pause
