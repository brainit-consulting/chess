@echo off
REM ============================================================
REM Scorpion Chess - Quick A/B Bench + Report (weak10 ladder)
REM Purpose: Run weak10 ladder and generate summary report.
REM ============================================================

cd /d H:\chess

echo Running weak10 ladder...
call bin\run_scorpion_sf_ladder_weak10.bat

for /f "delims=" %%H in ('git rev-parse main') do set BASELINE=%%H

call bin\run_benchmark_report.bat --run max15s_sf_ladder_weak10 --pgn-dir "H:\chess\benchmarks\baseline\max15s_sf_ladder_weak10" --engine Scorpion --baseline %BASELINE% --command "bin\\run_scorpion_sf_ladder_weak10.bat" --time-control max15s --opponent "Stockfish ladder weak10"
