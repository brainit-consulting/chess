# Self-Play + Diagnostics (Bench Only)

This guide covers running the self-play benchmark and collecting root-move diagnostics.

## Run self-play

Run a batch with swap + FEN suite:

```sh
npm run bench:selfplay -- --hardMs 800 --maxMs 3000 --batch 5 --swap --fenSuite --seed 7000 --runId phase4_1b-fastcheck
```

Outputs:
- `benchmarks/selfplay/run-<runId>/game-XXXX.pgn`
- `benchmarks/selfplay/run-<runId>/game-XXXX-meta.json`
- `benchmarks/selfplay/run-<runId>/summary.json`

## Run diagnostics summary

There is no npm script for diagnostics yet, so invoke the summarizer directly:

```sh
npx tsx scripts/bench/summarizeDiagnostics.ts benchmarks/selfplay/run-phase4_1b-fastcheck
```

The summary reports:
- Chosen move reasons
- Repeat kind at the chosen move
- How often a close non-repeat existed
- Average eval gap between best repeat and best non-repeat
- Breakdowns by side

## Notes

- Diagnostics are collected per move in `moveDiagnostics` inside each game meta JSON.
- Timeouts are still recorded exactly as before; diagnostics use a small grace window to
  allow the worker to return reasoning after a timeout.
