# Understand the modes of the BrainIT Chess Engine

This document explains how the BrainIT Chess Engine difficulty modes behave today and how they compare.

## Quick answer: which mode is strongest?

Yes: **Max Thinking** is the strongest setting in the current codebase. It is designed to search deeper than **Hard** by using a time budget with iterative deepening. Hard is a fixed depth search (depth 3), while Max Thinking searches multiple depths until time runs out (up to a depth cap).

That makes Max Thinking stronger in most positions, at the cost of more compute time per move.

## What all modes have in common

All modes share:

- Same rules engine and legal move generation.
- Same alpha-beta search core.
- Same Play-for-Win rules in AI vs AI (if enabled).

Max Thinking adds extra evaluation terms (listed below), while Easy/Medium/Hard keep the baseline evaluation.

## Difficulty comparison (current implementation)

Source: `src/ai/ai.ts` and `src/ai/search.ts`.

| Mode | Search type | Default depth/time | Notes |
| --- | --- | --- | --- |
| Easy | Fixed depth | depth 1 | Fast, intentionally weak. |
| Medium | Fixed depth | depth 2 | Balanced speed/strength. |
| Hard | Fixed depth | depth 3 | Strongest fixed-depth mode. |
| Max Thinking | Timed iterative deepening | time budget with cap | Strongest overall; adds extra evaluation terms and keeps searching until time runs out. |

### Max Thinking defaults

These are currently defined in `src/ai/ai.ts` and applied in `src/game.ts`:

- **Max depth cap**: `MAX_THINKING_DEPTH_CAP = 7`
- **Human vs AI movetime**: `MAX_THINKING_HUMAN_VS_AI_MS = 1000`
- **AI vs AI movetime**: `MAX_THINKING_AI_VS_AI_MS = 700`

Max Thinking runs iterative deepening from depth 1 up to the cap and returns the best fully completed depth inside the time budget.

## Max Thinking evaluation extras

Max Thinking adds additional, interpretable heuristics:

- King safety (opening safety, castling, pawn shield).
- Early queen development penalty.
- Piece-square tables for knights and bishops.

Easy/Medium/Hard do not use these extra terms.

## Max Thinking search extras (Phase 2A/2B)

Max Thinking also adds search-only improvements:

- **Quiescence search** at leaf nodes (captures + checks only).
- **Mate-distance scoring** to prefer shorter mates.
- **Transposition table** for caching scores and best moves across depth passes.
- **Mate-aware move ordering** (TT best move first, checks and high-value captures prioritized).

Easy/Medium/Hard do not use these search extras.

## Why Max Thinking is stronger than Hard

Hard uses a fixed **depth 3** search. Max Thinking uses **iterative deepening with a time budget** and can reach deeper depths (up to cap 7). In practice:

- More depth means more tactics are found.
- Timed search adapts: it spends more time in complex positions and less in simple ones.

Therefore Max Thinking is expected to outperform Hard under the same rules and evaluation.

## Responsiveness and workers

All AI move selection runs in Web Workers. The UI remains responsive even when Max Thinking is used, because computation happens off the main thread.

The "Why this move?" analysis uses a **separate worker** from the AI move worker, so it does not block normal move search.

## Play-for-Win (AI vs AI only)

Play-for-Win uses a repetition penalty and fairness window during move selection. It is **symmetric** for White and Black and applies to all difficulties (including Max Thinking) when enabled. It avoids repetition loops without forcing bad moves.

## When to use each mode

- **Easy**: fastest, most forgiving.
- **Medium**: good for casual play.
- **Hard**: strongest fixed-depth mode; consistent move time.
- **Max Thinking**: strongest overall; best for serious practice or engine-vs-engine games.

## Key code references (current)

- Difficulty enum and Max Thinking defaults: `src/ai/ai.ts`
- Timed search loop: `findBestMoveTimed` in `src/ai/search.ts`
- Per-mode time budget selection: `scheduleAiMove` in `src/game.ts`

## Summary

Max Thinking is the strongest available mode because it uses a time budget, deeper search, and extra evaluation heuristics. Hard remains faster and more predictable but is weaker on tactics and long forcing lines. All modes share the same rules and legal move generation.
