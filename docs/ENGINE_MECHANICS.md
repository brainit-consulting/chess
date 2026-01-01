# Engine Mechanics (Current)

This is a code-backed summary of how the Scorpion Chess Engine currently works and where the mechanics live.
Version: 1.1.57

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
    - King ring safety penalty (counts opponent attacks on adjacent king squares; reduced toward endgame; only when queens remain)
- Search (alpha-beta + quiescence + iterative deepening)
  - `src/ai/search.ts`
    - `findBestMove` (fixed depth)
    - `findBestMoveTimed` (iterative deepening to `maxDepth` with time cap)
    - `alphaBeta` (principal search with optional null-move + LMR when `maxThinking`)
    - `quiescence` (max-thinking only; capture/check filtering + SEE pruning)
    - Hard micro-quiescence (check-only at leaf; depth 1 max)
    - Forcing extensions (+1 ply for checks/promotions; depth/ply capped)
    - `runAspirationSearch` (max-thinking only; aspiration windows)
- Transposition table
  - `src/ai/search.ts`
    - `TTEntry` + `tt` Map for Max; small fixed-size TT for Hard
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
- Quiescence: Max uses full quiescence (`QUIESCENCE_MAX_DEPTH` = 4); Hard uses check-only micro-quiescence at leaf nodes.
- Null-move pruning: max-thinking only; Hard uses a conservative null-move gate (depth >= 4, not in check, material threshold).
- LMR (late move reductions): max-thinking only; Hard uses a conservative LMR gate (depth >= 4, later quiet moves only).
- PVS (principal variation search): enabled for Hard + Max; non-PV moves are searched with a null window and re-searched on fail-high.
- Forcing extensions: +1 ply on checks/promotions (depth/ply capped).
- Move ordering:
  - Base heuristic: promotions, captures, checks, hanging piece penalty, minor development bonus.
  - Max-thinking adds: SEE capture penalty, larger check bonus, TT best move, killer/history, countermove boosts.
  - Hard uses a smaller history bonus for quiet moves (no killer/countermove).
  - When in check, evasions are ordered first (moves that resolve check).
  - In-check evasion ordering prefers capture > block > king move and penalizes king moves into attacked squares.
- Transposition table: Max uses a full Map; Hard uses a small fixed-size TT.
- Repetition avoidance:
  - Only when `playForWin` is passed and `recentPositions` is present.
  - Root scoring applies a repetition penalty that scales with advantage and skips clearly losing or forced-repeat lines.
  - Root contempt bias further nudges repeat/drawish lines down when not losing (per-difficulty cp bias).
  - Near repetition (position seen once) incurs a mild penalty; twofold repulsion (seen once) is stronger than generic near-repeat; immediate threefold risk (seen 2+ times) incurs a larger penalty.
  - Max uses a higher penalty scale and an extra loop multiplier when the same position has already repeated.
  - A root-level tie-breaker prefers a close-scoring non-repetition move when the top move repeats and the side is not losing.
  - A root repeat-ban window: if the best move repeats and a non-repeat is within the window (Hard 60cp, Max 100cp), choose the best non-repeat when not losing (draw-hold threshold allows defensive repetition).
  - Two-ply anti-loop penalty on the top root moves if the opponent's best reply quickly returns to a recent position (larger penalty for Max; lightweight for Hard).
  - Repetition penalties and loop penalties are skipped when below the draw-hold threshold (defensive draw allowed).
  - Hard also applies a small, advantage-gated tie-break nudge (via `hardRepetitionNudgeScale`) to reduce early loops.
  - Root ordering deprioritizes quiet repeat moves when not losing, keeping non-repeat quiet moves earlier in the PV.
  - Root scoring adds a small progress bias for quiet development (early minor development, castling/king safety, pawn advances) and a small penalty for rook shuffle repeats, gated by `playForWin` and draw-hold threshold.
  - `DEFAULT_REPETITION_PENALTY`, `DEFAULT_TOP_MOVE_WINDOW`, `DEFAULT_FAIRNESS_WINDOW` in `src/ai/search.ts`.
  - Checkmate scoring uses mate distance for both Hard and Max (shorter mates preferred; longer losses delayed).

## Evaluation details

- Base (`evaluateState`):
  - Material sum (PIECE_VALUES).
  - Mobility (legal move count diff * `MOBILITY_WEIGHT`).
  - Check penalty (`CHECK_PENALTY`).
  - King exposure penalties after move 10 when uncastled or centrally stuck without castling rights (scaled when queens remain).
  - File pressure: rooks/queens on open or semi-open files toward the king, and king penalties on open files vs enemy rook/queen.
- Max-thinking extras (`evaluateMaxThinking`):
  - Opening king safety (castling/home bonuses, king move penalty, pawn shield).
  - Early queen development penalty.
  - Extra king-ring pawn shield penalty around the king file.
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
  - If `maxTimeMs` is provided (live gameplay sets 1000ms), uses `findBestMoveTimed` with `maxThinking: false`.
  - Otherwise uses `findBestMove` depth 3.
  - Uses a small bounded TT and check-only micro-quiescence at leaf nodes.
  - Forcing extensions on checks/promotions (depth/ply capped).
  - No null-move, no LMR, no full quiescence, no PVS.
  - Modest history ordering for quiet moves.
  - RNG: seeded if provided; otherwise `Math.random`.
- Max
  - Depth cap: `MAX_THINKING_DEPTH_CAP` (7).
  - Time cap: `MAX_THINKING_CAP_MS` (10,000ms).
  - Uses `findBestMoveTimed` with `maxThinking: true`.
  - Enables TT, killer/history ordering, countermove ordering, PVS, quiescence, null-move, LMR, aspiration windows, forcing extensions.
  - RNG: seeded if provided; otherwise `Math.random`.

## Live gameplay time caps (Hard/Max)

- Hard:
  - `HARD_THINKING_MS = 1000` in `src/game.ts`.
  - Set in `scheduleAiMove` via `maxTimeMs` when difficulty is `hard`.
- Max:
  - `MAX_THINKING_CAP_MS = 10000` in `src/ai/ai.ts` and `src/game.ts`.
  - `startMaxThinkingTimer` forces a move at 10s via `forceAiMoveNow`.
