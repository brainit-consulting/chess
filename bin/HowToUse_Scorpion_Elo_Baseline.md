# How to Measure a Baseline Elo for Scorpion Chess (MaxThinking)

This guide documents **exactly how to measure a baseline Elo** for the Scorpion Chess Engine using the **existing Stockfish integration and bench harness** in this repository.

It is written to be:
- Manual
- Reproducible
- Command-line only (no Codex required)
- Safe for `main` (no code changes needed)

The process mirrors how serious engine developers establish **relative Elo strength**.

---

## Overview (What You Are Doing)

You will run **engine vs engine matches**:

1. **Sanity check** – confirm everything runs
2. **Stockfish ladder** – find a similar-strength opponent
3. **Baseline run** – play many games to estimate Elo

Elo is **relative** to the opponent and settings used.  
This baseline is primarily for **tracking Scorpion’s progress over time**.

---

## Prerequisites

- Windows
- Node.js 18+ (tested on Node 22)
- `tsx` installed (already used by the repo)
- Scorpion repo located at:

```
H:\chess
```

- Stockfish-compatible engine available at:

```
H:\chess\bin\ScorpionHeart.exe
```

- Bench harness script:

```
scripts\bench\quickVsStockfish.ts
```

---

## Files You Will Use

Place these batch files anywhere you like (recommended: `H:\chess\bin\`):

- `run_scorpion_sanity_explicit.bat`
- `run_scorpion_sf_ladder.bat`
- `run_scorpion_baseline.bat`

All scripts use **explicit paths** and always run from `H:\chess`.

---

## Step 1 — Sanity Check (Run First)

### When to run
- First time setup
- After engine changes
- After upgrading Node or dependencies

### What it does
- Runs **4 games only**
- Confirms:
  - engine launches
  - UCI handshake works
  - results are produced

### How to run
Double-click:

```
run_scorpion_sanity_explicit.bat
```

### Expected output
You should see lines like:

```
Game 1: 0-1 (loss)
Game 2: 1-0 (win)
...
```

If this step fails, **do not proceed**.

---

## Step 2 — Stockfish Time Ladder (Find Similar Strength)

### When to run
- After sanity check passes
- When establishing a new baseline

### What it does
- Scorpion plays against Stockfish at **multiple movetimes**
- Each ladder step runs a small batch of games
- Goal: find where Scorpion scores **~50%**

### How to run
Double-click:

```
run_scorpion_sf_ladder.bat
```

### Ladder configuration (default)
- Scorpion: MaxThinking, 15000 ms
- Stockfish ladder:

```
3000, 5000, 8000, 12000, 15000, 20000
```

- 80 games per step
- Colors swapped
- Opening suite enabled

### What to look for
In the summary output, identify the Stockfish movetime where:
- Win rate is closest to 50%
- Elo delta is closest to 0

That movetime becomes your **baseline opponent**.

---

## Step 3 — Baseline Run (Estimate Elo)

### When to run
- After completing the ladder
- After selecting the closest Stockfish movetime

### What it does
- Runs **many games** (default: 600)
- Produces a stable W/D/L distribution
- Used to estimate baseline Elo

### How to configure
Open:

```
run_scorpion_baseline.bat
```

Edit this line:

```bat
set STOCKFISH_MOVETIME_MS=12000
```

Replace `12000` with the best ladder result.

### How to run
Double-click:

```
run_scorpion_baseline.bat
```

### Runtime expectations
- Long-running (tens of minutes to hours)
- Console output may be quiet while engines think
- CPU usage should be visible

---

## Where Results Are Written

Results are written to:

```
H:\chess\benchmarks\baseline\
```

Folders are created per run:
- Ladder results
- Baseline results

These include:
- PGNs
- Summary JSON
- Win/Draw/Loss statistics
- Elo deltas (if enabled by the harness)

---

## Interpreting the Result

Your final statement should look like:

> Scorpion (MaxThinking, 15s/move) ≈ Stockfish (12s/move) on this machine

This is a **baseline**, not an absolute rating.

To compare improvements:
- Re-run the **baseline script**
- Keep all settings identical
- Compare Elo deltas over time

---

## Important Notes

- Elo depends on:
  - hardware
  - time control
  - opening suite
  - engine version
- Always compare runs **only within the same setup**
- Use `--seed`, `--swap`, and `--fenSuite` consistently

---

## Recommended Workflow

1. Sanity check
2. Ladder run
3. Baseline run
4. Commit engine changes
5. Repeat baseline to measure improvement

---

## End

This document intentionally reflects a **real, working workflow** used for Scorpion Chess.
