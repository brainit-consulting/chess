# Planned Improvements for Max Thinking

This document lists candidate improvements to the Max Thinking mode. It is a planning list only; no code changes are implied.

## Search-Quality Upgrades (high ROI)

- Quiescence extensions: include checks, promotions, and forced recaptures to stabilize leaf evaluation.
- Move ordering: checks first, MVV-LVA for captures, TT best move first, killer/history heuristics.
- Static exchange evaluation (SEE): filter losing captures before search explores them.
- Null-move pruning (conservative): quick cutoffs in quiet positions with safe depth reductions.
- Late move reductions (LMR): reduce depth for low-priority moves to search key lines deeper.
- Aspiration windows: search around prior score to reduce re-search overhead.

## Evaluation Tweaks (lightweight, explainable)

- King safety tuning: slightly stronger penalties for exposed kings or missing pawn shields.
- Phase-aware PSTs: simple king/queen tables that shift between opening and endgame.
- Mate-distance bias: keep preferring shorter mates once a forced mate is detected.

## Transposition Table Enhancements

- Store node type + best move per ply; improve reuse across iterative deepening.
- Add simple aging/bucketed replacement to reduce collision churn.

## Performance/Responsiveness Safeguards

- Keep Max-only gating for all new logic.
- Avoid raising time budgets or depth caps unless explicitly approved.

## Suggested Phasing (when you decide)

1) Move ordering + SEE (tactical stability, faster pruning).
2) Conservative null-move + LMR (better depth usage).
3) Quiescence extensions + aspiration windows (stability + speed).
4) Eval fine-tuning (king safety + PSTs) if needed.

---

Awaiting your direction on which items to implement first.
