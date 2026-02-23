# Bug Tracker

- [x] 2026-01-14 11:28 ET: Root search fails to build due to duplicate `rootOrdered` declaration in `src/ai/search.ts` after capture-safety change. Repro: run `bin\\run_ab_weak4_and_report.bat`; error "The symbol \"rootOrdered\" has already been declared." Fixed by removing the duplicate declaration.
- [x] 2026-01-14 11:31 ET: Engine runtime error "rootOrdered is not defined" in `scoreRootMoves` after adding root capture safety filter. Repro: run `bin\\run_ab_weak4_and_report.bat`; game aborts with engine_worker_error. Fixed by defining `rootOrdered` in `scoreRootMoves`.
