@echo off
REM ============================================================
REM Scorpion Chess - Benchmark Report Generator
REM Purpose: Create a benchmark summary report with metadata.
REM ============================================================

cd /d H:\chess

if "%~1"=="" (
  echo Usage: run_benchmark_report.bat --run ^<run_name^> [--pgn-dir ^<dir^>] [--engine ^<name^>]
  echo Example: run_benchmark_report.bat --run max15s_sf_ladder_weak6_swap --pgn-dir "H:\chess\benchmarks\baseline\max15s_sf_ladder_weak6_swap" --engine Scorpion
  goto :eof
)

node --import tsx scripts\analysis\createBenchmarkReport.ts %*

pause
