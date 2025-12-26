# Planned Improvements for Max Thinking

This document lists candidate improvements to the Max Thinking mode. Items marked as implemented reflect current code.

## Implemented (current code)

- Quiescence search at leaf nodes (captures + checks only).
- Mate-distance scoring to prefer shorter mates when a mate is proven.
- Transposition table with best-move reuse across iterative deepening.
- Move ordering upgrades: TT best move first, checks/captures prioritized, killer/history heuristics.
- Aspiration windows in iterative deepening to reduce re-search overhead.
- SEE-lite capture filter to deprioritize clearly losing captures.
- Late move reductions (LMR) for low-priority quiet moves.
- Max-only eval heuristics: king safety, early queen penalty, knight/bishop PSTs.

## Search-Quality Upgrades (high ROI)

- Quiescence extensions: include promotions and forced recaptures to stabilize leaf evaluation.
- Static exchange evaluation (SEE): filter losing captures before search explores them.
- Null-move pruning (conservative): quick cutoffs in quiet positions with safe depth reductions.
- Late move reductions (LMR): reduce depth for low-priority moves to search key lines deeper.

## Evaluation Tweaks (lightweight, explainable)

- King safety tuning: stronger penalties for exposed kings or missing pawn shields.
- Phase-aware PSTs: simple king/queen tables that shift between opening and endgame.

## Transposition Table Enhancements

- Add simple aging/bucketed replacement to reduce collision churn.

## Performance/Responsiveness Safeguards

- Keep Max-only gating for all new logic.
- Avoid raising time budgets or depth caps unless explicitly approved.

## Suggested Phasing (when you decide)

1) SEE-lite + quiescence extensions (tactical stability).
2) Conservative null-move + LMR (better depth usage).
3) Eval fine-tuning (phase-aware PSTs) if needed.

---

Awaiting your direction on which items to implement first.
