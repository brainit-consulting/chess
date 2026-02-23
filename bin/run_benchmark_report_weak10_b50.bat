@echo off
REM ============================================================
REM Scorpion Chess - Benchmark Report (weak10 b50)
REM Purpose: Generate summary report for the b50 run.
REM ============================================================

cd /d H:\chess

for /f "delims=" %%H in ('git rev-parse HEAD') do set BASELINE=%%H

bin\run_benchmark_report.bat --run max15s_sf_ladder_weak10_b50 --pgn-dir "H:\chess\benchmarks\baseline\max15s_sf_ladder_weak10_b50" --engine Scorpion --baseline %BASELINE% --time-control max15s --opponent "Stockfish ladder weak10"

pause
