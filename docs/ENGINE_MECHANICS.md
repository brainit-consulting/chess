# Engine Mechanics (Current)

This is a code-backed summary of how the Scorpion Chess Engine currently works and where the mechanics live.
Version: 1.1.52

## Code map (by subsystem)

- Move generation + legality
  - `src/rules/index.ts`
    - `getAllLegalMoves`, `getLegalMovesForSquare`, `generatePseudoMoves`, `isMoveLegal`
    - Per-piece generators: `generatePawnMoves`, `generateSlidingMoves`, `generateKnightMoves`, `generateKingMoves`
    - Legality checks: `isMoveLegal` (rejects illegal castling through check and moves leaving king in check)
    - Move application: `applyMove` (captures, en passant, castling, promotions, halfmove clock, castling rights)
- Evaluation
  - `src/ai/evaluate.ts`
    - `evaluateState` (material + mobility + check penalty + optional max-thinking terms)
    - `evaluateMaxThinking` (king safety in opening, early queen penalty, knight/bishop PST)
- Search (alpha-beta + quiescence + iterative deepening)
  - `src/ai/search.ts`
    - `findBestMove` (fixed depth)
    - `findBestMoveTimed` (iterative deepening to `maxDepth` with time cap)
    - `alphaBeta` (principal search with optional null-move + LMR when `maxThinking`)
    - `quiescence` (max-thinking only; capture/check filtering + SEE pruning)
    - `runAspirationSearch` (max-thinking only; aspiration windows)
- Transposition table
  - `src/ai/search.ts`
    - `TTEntry` + `tt` Map used only when `maxThinking` is true
    - Keyed by `getPositionKey` (`src/rules/index.ts`)
- Move ordering heuristics
  - `src/ai/search.ts`
    - `orderMoves`, `buildOrderScore`, `scoreMoveHeuristic`
    - Max-thinking extras: TT best move bias, killer moves, history heuristic, SEE penalties, check bonuses
- Repetition / draw detection
  - `src/rules/index.ts`
    - `getGameStatus` (threefold repetition, insufficient material, stalemate)
    - `getPositionKey`, `recordPosition`, `positionCounts` map
    - `halfmoveClock` is tracked in `applyMove`, but no 50-move draw rule is applied
- Time budgeting + stop/force wiring
  - `src/ai/ai.ts` (difficulty-specific caps, passes `maxTimeMs` to search)
  - `src/game.ts` (live game scheduling and force-stop)
    - `scheduleAiMove` sets `maxTimeMs` and `maxDepth`
    - `startMaxThinkingTimer` + `forceAiMoveNow` enforce the 10s cap
  - `src/ai/aiWorker.ts` (worker stop signals to `chooseMove`)

## Search details (what is actually active)

- Alpha-beta: `alphaBeta` in `src/ai/search.ts`.
- Iterative deepening: `findBestMoveTimed` loops depth 1..`maxDepth`.
- Quiescence: only when `maxThinking` is true; `QUIESCENCE_MAX_DEPTH` = 4.
- Null-move pruning: only when `maxThinking` is true; gated by depth/material.
- LMR (late move reductions): only when `maxThinking` is true.
- Move ordering:
  - Base heuristic: promotions, captures, checks, hanging piece penalty, minor development bonus.
  - Max-thinking adds: SEE capture penalty, larger check bonus, TT best move, killer/history.
- Transposition table: only for `maxThinking` search.
- Repetition avoidance:
  - Only when `playForWin` is passed and `recentPositions` is present.
  - Root scoring applies a repetition penalty that scales with advantage and skips clearly losing or forced-repeat lines.
  - Max uses a higher penalty scale and an extra loop multiplier when the same position has already repeated.
  - `DEFAULT_REPETITION_PENALTY`, `DEFAULT_TOP_MOVE_WINDOW`, `DEFAULT_FAIRNESS_WINDOW` in `src/ai/search.ts`.

## Evaluation details

- Base (`evaluateState`):
  - Material sum (PIECE_VALUES).
  - Mobility (legal move count diff * `MOBILITY_WEIGHT`).
  - Check penalty (`CHECK_PENALTY`).
- Max-thinking extras (`evaluateMaxThinking`):
  - Opening king safety (castling/home bonuses, king move penalty, pawn shield).
  - Early queen development penalty.
  - Knight and bishop PST tables.

## Draw / repetition mechanics

- Threefold repetition:
  - `getPositionKey` uses: piece placement + active color + castling rights + en passant.
  - `recordPosition` is called in `applyMove`.
  - `getGameStatus` declares draw if `getPositionCount(state) >= 3`.
- Stalemate: no legal moves and not in check.
- Insufficient material: simplified minor/major material checks.
- 50-move rule: not enforced (halfmove clock is tracked but unused in `getGameStatus`).

## Difficulty differences (current)

Source: `src/ai/ai.ts` (`chooseMove`) and `src/game.ts` (`scheduleAiMove`).

- Easy
  - Depth: 1 (`DEPTH_BY_DIFFICULTY`).
  - Uses `findBestMove` (no time cap).
  - `maxThinking`: false.
  - RNG: seeded if provided; otherwise `Math.random`.
- Medium
  - Depth: 2.
  - Uses `findBestMove`.
  - `maxThinking`: false.
  - RNG: seeded if provided; otherwise `Math.random`.
- Hard
  - Depth: 3.
  - If `maxTimeMs` is provided (live gameplay sets 800ms), uses `findBestMoveTimed` with `maxThinking: false`.
  - Otherwise uses `findBestMove` depth 3.
  - No TT, no quiescence, no null-move, no LMR.
  - RNG: seeded if provided; otherwise `Math.random`.
- Max
  - Depth cap: `MAX_THINKING_DEPTH_CAP` (7).
  - Time cap: `MAX_THINKING_CAP_MS` (10,000ms).
  - Uses `findBestMoveTimed` with `maxThinking: true`.
  - Enables TT, killer/history ordering, quiescence, null-move, LMR, aspiration windows.
  - RNG: seeded if provided; otherwise `Math.random`.

## Live gameplay time caps (Hard/Max)

- Hard:
  - `HARD_THINKING_MS = 800` in `src/game.ts`.
  - Set in `scheduleAiMove` via `maxTimeMs` when difficulty is `hard`.
- Max:
  - `MAX_THINKING_CAP_MS = 10000` in `src/ai/ai.ts` and `src/game.ts`.
  - `startMaxThinkingTimer` forces a move at 10s via `forceAiMoveNow`.
