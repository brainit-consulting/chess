@echo off
REM ============================================================
REM Scorpion Chess - Quick A/B Bench + Report (weak4 ladder)
REM Purpose: Run weak4 ladder and generate summary report.
REM ============================================================

cd /d H:\chess

echo Running weak4 ladder...
call bin\run_scorpion_sf_ladder_weak4.bat

for /f "delims=" %%H in ('git rev-parse main') do set BASELINE=%%H

call bin\run_benchmark_report.bat --run max15s_sf_ladder_weak4 --pgn-dir "H:\chess\benchmarks\baseline\max15s_sf_ladder_weak4" --engine Scorpion --baseline %BASELINE% --command "bin\\run_scorpion_sf_ladder_weak4.bat" --time-control max15s --opponent "Stockfish ladder weak4"
