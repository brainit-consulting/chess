# AGENTS

## Required Reading
- At the start of every session and before any commit, read `docs/Incremental_Engine_Improvements_PRD.md` and follow its workflow and acceptance criteria.

## Git Identity
- Preferred commit author email for this repo: `dutoit.emile@gmail.com`.
- Before creating commits, set repo/local git config `user.email` to this value unless explicitly instructed otherwise.
- Note: commit email affects commit metadata only and does not provide remote push authentication.

## Current Task Status (ET)
- Timestamp (ET): 2026-01-18 12:52 ET
- Current focus: Implement conservative LMR (quiet-only, safe re-search).
- Status:
  - [~] Move ordering PV history boost: regression (weak4 0-1-9).
  - [~] PGN scan: frequent large material drops (queen/rook hangs).
  - [~] Hanging major piece penalty: regression (weak4 0-3-7), reverted for clean A/B.
  - [~] LPDO-style major piece safety penalty: regression (weak4 0-2-8), reverted for clean A/B.
  - [~] SEE-lite capture safety (queen/rook) in move ordering: regression (weak4 0-0-10), reverted for clean A/B.
  - [~] Root capture sanity check (queen/rook, negative SEE-lite): regression (weak4 0-1-9), reverted for clean A/B.
  - [~] Root moved-piece hang filter (queen/rook, SEE-lite): regression (weak4 0-0-10), reverted for clean A/B.
  - [~] Root quiet-move queen/rook hang filter: regression (weak4 0-0-10), dropped.
  - [~] Late move reductions (quiet-only, re-search on fail-high) in progress.
  - [~] Quick signal protocol: 10-game run; continue if >=10% or >=+5% vs baseline.
  - [~] Last benchmark: max15s_sf_ladder_weak4 0-0-10 (regression, 10-game quick signal).

## Update Rules
- Update this file whenever task status changes, a benchmark starts, or a decision is made.
- Use [X] for completed and [~] for in progress; record pass/fail outcomes when completed.
