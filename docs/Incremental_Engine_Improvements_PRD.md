# PRD - Incremental, Verifiable Engine Improvements

## 1) Overview
Establish a workflow that requires **small, incremental engine changes** to be **measured and proven** via benchmarks or other reproducible methods before they are considered improvements. The goal is to prevent regressions, reduce noisy conclusions, and produce a clear, evidence-based progress trail for Scorpion.

## 2) Goals
- Make every engine change testable with a **baseline vs variant** benchmark.
- Standardize **benchmark settings**, **sample sizes**, and **reporting**.
- Produce **verifiable improvement claims** backed by data.
- Keep the loop lightweight so it is feasible to run frequently.

## 3) Non-Goals
- Large, multi-week refactors without intermediate measurable checkpoints.
- Introducing external tooling that requires network access.
- Publishing Elo claims without reproducible runs in this repo.

## 4) Definitions
- **Baseline**: The current `main` or last accepted strong build.
- **Variant**: A branch or commit with a single focused change.
- **Batch**: A fixed set of games using the same settings.
- **Benchmark**: A repeatable test run producing a measurable outcome.

## 5) Success Metrics
Primary metrics:
- **Score percentage** vs opponent (wins + 0.5 * draws).
- **Elo estimate** (relative, not absolute).
- **Confidence**: improvement must clear the acceptance threshold below.

Secondary metrics (diagnostic only):
- **Mate rate** (games decided by mate).
- **Average game length** (ply).
- **Time usage** and timeouts.

## 6) Workflow (Incremental Improvement Loop)
1. **Hypothesis**: State the expected improvement and why.
2. **Change scope**: Single code change or small cluster with one intent.
3. **Sanity check**: Run a quick sanity batch to ensure the engine works.
4. **Benchmark selection**: Choose the smallest benchmark that can detect the effect.
5. **A/B run**: Run Baseline vs Variant with identical settings.
6. **Report generation**: Use the report script to capture metadata and results.
7. **Analysis**: Compute score and Elo; compare to acceptance criteria.
8. **Decision**:
   - If improvement is proven, mark as accepted.
   - If not proven, revert or refine and re-run.

## 7) Benchmark Suite (Initial)
Use existing harness/scripts. Start with the smallest viable test:
- **Smoke**: 4-12 games (sanity only, not proof of improvement).
- **Quick ladder**: `max15s_sf_ladder_weak6_swap` for early signal.
- **Baseline run**: `baseline_max15s_vs_sf12000` for stronger confidence.

The chosen benchmark must be recorded in the report, including:
- Time control
- Opponent settings
- Game count
- Color distribution

## 8) Acceptance Criteria
An improvement is accepted only if it meets **all**:
- **Sample size**: minimum 200 games for acceptance (50 for exploratory only).
- **Score threshold**: > 55% score over the matched run OR
- **Elo threshold**: +15 Elo with 95% confidence above 0.
- **No sanity regressions** (sanity batch must pass).

If thresholds are not met, classify the change as **inconclusive** or **regression**.

## 9) Reporting and Storage
Each benchmark run must produce:
- **Raw PGNs** in `benchmarks/<run_name>/`.
- **Summary report** in `analysis/<run_name>_summary.md`.
- **Run metadata**: git hash, branch, settings, and commands used.

Use `scripts/analysis/createBenchmarkReport.ts` (or `bin/run_benchmark_report.bat`) to generate the report template. If `--pgn-dir` is provided, W/D/L and score are auto-filled.

## 10) Risks and Mitigations
- **Noisy results**: enforce sample size and fixed settings.
- **Hidden regressions**: require sanity checks before every run.
- **False positives**: require confidence thresholds, not just score swings.

## 11) Dependencies
- Existing bench harness and scripts in `scripts/` and `bin/`.
- Local Stockfish integration already configured in repo docs.

## Appendix A) Benchmark Report Template
```
# Benchmark Report - <run_name>

## 1) Purpose
- Hypothesis:
- Change summary:

## 2) Settings
- Baseline git hash:
- Variant git hash:
- Branch:
- Script/command:
- Time control:
- Opponent settings:
- Games:
- Run date:

## 3) Results
- W/D/L:
- Score %:
- Elo estimate:
- Confidence notes:

## 4) Decision
- Accepted / Inconclusive / Regression
- Rationale:
```

## Appendix B) Report Generator Usage
```
npx tsx scripts/analysis/createBenchmarkReport.ts --run max15s_sf_ladder_weak6_swap --pgn-dir "H:\chess\benchmarks\baseline\max15s_sf_ladder_weak6_swap" --engine Scorpion
```
