import {
  Color,
  GameState,
  Piece,
  Move,
  getAllLegalMoves,
  getPieceAt,
  getPositionKey,
  isInCheck,
  applyMove
} from '../rules';
import { PIECE_VALUES, evaluateState } from './evaluate';

type SearchOptions = {
  depth: number;
  rng: () => number;
  legalMoves?: Move[];
  playForWin?: boolean;
  recentPositions?: string[];
  repetitionPenalty?: number;
  topMoveWindow?: number;
  fairnessWindow?: number;
  maxThinking?: boolean;
  tt?: Map<string, TTEntry>;
  ordering?: OrderingState;
  maxTimeMs?: number;
  now?: () => number;
  stopRequested?: () => boolean;
};

const MATE_SCORE = 20000;
const DEFAULT_REPETITION_PENALTY = 15;
const DEFAULT_TOP_MOVE_WINDOW = 10;
const DEFAULT_FAIRNESS_WINDOW = 25;
const DEFAULT_ASPIRATION_WINDOW = 35;
const DEFAULT_ASPIRATION_MAX_RETRIES = 3;
const SEE_ORDER_PENALTY_THRESHOLD = -200;
const SEE_ORDER_PENALTY_BASE = 400;
const SEE_QUIESCENCE_PRUNE_THRESHOLD = -350;
const LMR_MIN_DEPTH = 3;
const LMR_START_MOVE = 3;
const LMR_REDUCTION = 1;
const NULL_MOVE_MIN_DEPTH = 3;
const NULL_MOVE_REDUCTION = 2;
const NULL_MOVE_MIN_MATERIAL = 1200;
const QUIESCENCE_MAX_DEPTH = 4;

type TTFlag = 'exact' | 'alpha' | 'beta';

type TTEntry = {
  depth: number;
  score: number;
  flag: TTFlag;
  bestMove?: Move;
};

export type OrderingState = {
  killerMoves: { primary?: Move; secondary?: Move }[];
  history: number[];
};

export function createOrderingState(maxDepth: number): OrderingState {
  const maxPlies = Math.max(8, maxDepth + 6);
  return {
    killerMoves: Array.from({ length: maxPlies }, () => ({})),
    history: new Array(64 * 64).fill(0)
  };
}

type TimedSearchOptions = Omit<SearchOptions, 'depth'> & {
  maxDepth: number;
  maxTimeMs: number;
  now?: () => number;
  onDepth?: (depth: number) => void;
  aspirationWindow?: number;
  aspirationMaxRetries?: number;
};

export type MateProbeScoredMove = {
  move: Move;
  score: number;
  baseScore: number;
  mateInPly: number | null;
  mateInMoves: number | null;
};

export type MateProbeReport = {
  move: Move | null;
  score: number | null;
  mateInPly: number | null;
  mateInMoves: number | null;
  depthCompleted: number;
  scoredMoves: MateProbeScoredMove[];
  ttEntries?: number;
  aspirationRetries?: number;
};

export function findBestMove(state: GameState, color: Color, options: SearchOptions): Move | null {
  const legalMoves = options.legalMoves ?? getAllLegalMoves(state, color);
  if (legalMoves.length === 0) {
    return null;
  }

  const now = options.now ?? defaultNow;
  const start = options.maxTimeMs ? now() : 0;
  let nodeCounter = 0;
  const shouldStop = () => {
    if (options.stopRequested && options.stopRequested()) {
      return true;
    }
    if (options.maxTimeMs === undefined) {
      return false;
    }
    return now() - start >= options.maxTimeMs;
  };
  const shouldStopChecked =
    options.maxTimeMs !== undefined || options.stopRequested
      ? () => {
          nodeCounter += 1;
          if ((nodeCounter & 63) !== 0) {
            return false;
          }
          return shouldStop();
        }
      : undefined;

  const ordering = options.maxThinking
    ? options.ordering ?? createOrderingState(options.depth + 4)
    : undefined;
  const preferred =
    options.maxThinking && options.tt
      ? options.tt.get(getPositionKey(state))?.bestMove
      : undefined;
  const ordered = orderMoves(state, legalMoves, color, options.rng, {
    preferred,
    maxThinking: options.maxThinking,
    ordering,
    ply: 0
  });
  let bestSoFar: Move | null = ordered[0] ?? legalMoves[0] ?? null;
  const scoredMoves: { move: Move; score: number; baseScore: number }[] = [];
  const playForWin = Boolean(options.playForWin && options.recentPositions?.length);
  const repetitionPenalty = options.repetitionPenalty ?? DEFAULT_REPETITION_PENALTY;
  const topMoveWindow = options.topMoveWindow ?? DEFAULT_TOP_MOVE_WINDOW;
  const fairnessWindow = options.fairnessWindow ?? DEFAULT_FAIRNESS_WINDOW;

  for (const move of ordered) {
    if (shouldStop()) {
      return bestSoFar ?? move;
    }
    const next = cloneState(state);
    next.activeColor = color;
    applyMove(next, move);

    let baseScore = alphaBeta(
      next,
      options.depth - 1,
      -Infinity,
      Infinity,
      opponentColor(color),
      color,
      options.rng,
      options.maxThinking ?? false,
      1,
      options.tt,
      ordering,
      shouldStopChecked
    );
    let score = baseScore;

    if (playForWin) {
      const key = getPositionKey(next);
      if (options.recentPositions?.includes(key)) {
        score -= repetitionPenalty;
      }
    }

    if (!bestSoFar) {
      bestSoFar = move;
    }
    scoredMoves.push({ move, score, baseScore });
  }

  if (scoredMoves.length === 1) {
    return scoredMoves[0].move;
  }

  const bestScore = Math.max(...scoredMoves.map((entry) => entry.score));
  const baseBest = Math.max(...scoredMoves.map((entry) => entry.baseScore));
  let windowed =
    playForWin && topMoveWindow > 0
      ? scoredMoves.filter((entry) => entry.score >= bestScore - topMoveWindow)
      : scoredMoves.filter((entry) => entry.score === bestScore);

  if (playForWin) {
    windowed = windowed.filter((entry) => entry.baseScore >= baseBest - fairnessWindow);
    if (windowed.length === 0) {
      const baseLeaders = scoredMoves.filter((entry) => entry.baseScore === baseBest);
      const index = Math.floor(options.rng() * baseLeaders.length);
      return baseLeaders[index].move;
    }
  }

  const index = Math.floor(options.rng() * windowed.length);
  return windowed[index].move;
}

export function findBestMoveTimed(
  state: GameState,
  color: Color,
  options: TimedSearchOptions
): Move | null {
  const legalMoves = options.legalMoves ?? getAllLegalMoves(state, color);
  if (legalMoves.length === 0) {
    return null;
  }

  const now = options.now ?? defaultNow;
  const start = now();
  const shouldStop = () => {
    if (options.stopRequested && options.stopRequested()) {
      return true;
    }
    return now() - start >= options.maxTimeMs;
  };
  let best: Move | null = null;
  let prevScore: number | null = null;
  const tt = options.maxThinking ? options.tt ?? new Map<string, TTEntry>() : undefined;
  const ordering = options.maxThinking
    ? options.ordering ?? createOrderingState(options.maxDepth + 4)
    : undefined;
  const aspirationWindow = options.maxThinking
    ? options.aspirationWindow ?? DEFAULT_ASPIRATION_WINDOW
    : 0;
  const aspirationMaxRetries =
    options.aspirationMaxRetries ?? DEFAULT_ASPIRATION_MAX_RETRIES;

  for (let depth = 1; depth <= options.maxDepth; depth += 1) {
    if (shouldStop()) {
      break;
    }
    if (ordering && depth > 1) {
      decayHistory(ordering);
    }
    options.onDepth?.(depth);
    let scored: { move: Move | null; score: number | null } | null = null;
    if (options.maxThinking && prevScore !== null && aspirationWindow > 0) {
      const outcome = runAspirationSearch(
        prevScore,
        aspirationWindow,
        aspirationMaxRetries,
        shouldStop,
        (alpha, beta) =>
          scoreRootMoves(
            state,
            color,
            {
              depth,
              rng: options.rng,
              legalMoves,
              playForWin: options.playForWin,
              recentPositions: options.recentPositions,
              repetitionPenalty: options.repetitionPenalty,
              topMoveWindow: options.topMoveWindow,
              fairnessWindow: options.fairnessWindow,
              maxThinking: options.maxThinking,
              tt,
              ordering
            },
            { alpha, beta },
            shouldStop
          ),
        (result) => result.score
      );
      scored = { move: outcome.result.move, score: outcome.result.score };
    } else {
      const result = scoreRootMoves(
        state,
        color,
        {
          depth,
          rng: options.rng,
          legalMoves,
          playForWin: options.playForWin,
          recentPositions: options.recentPositions,
          repetitionPenalty: options.repetitionPenalty,
          topMoveWindow: options.topMoveWindow,
          fairnessWindow: options.fairnessWindow,
          maxThinking: options.maxThinking,
          tt,
          ordering
        },
        undefined,
        shouldStop
      );
      scored = { move: result.move, score: result.score };
    }

    if (scored?.move) {
      best = scored.move;
      prevScore = scored.score;
    }
  }

  if (best) {
    return best;
  }

  return findBestMove(state, color, {
    depth: 1,
    rng: options.rng,
    legalMoves,
    playForWin: options.playForWin,
    recentPositions: options.recentPositions,
    repetitionPenalty: options.repetitionPenalty,
    topMoveWindow: options.topMoveWindow,
    fairnessWindow: options.fairnessWindow,
    maxThinking: options.maxThinking,
    tt,
    ordering
  });
}

type AspirationOutcome<T> = {
  result: T;
  retries: number;
  timedOut: boolean;
};

function runAspirationSearch<T>(
  prevScore: number,
  window: number,
  maxRetries: number,
  shouldStop: () => boolean,
  search: (alpha: number, beta: number) => T,
  getScore: (result: T) => number | null
): AspirationOutcome<T> {
  let retries = 0;
  let currentWindow = window;
  let result = search(prevScore - currentWindow, prevScore + currentWindow);

  while (true) {
    if (shouldStop()) {
      return { result, retries, timedOut: true };
    }
    const score = getScore(result);
    const alpha = prevScore - currentWindow;
    const beta = prevScore + currentWindow;
    if (score !== null && score > alpha && score < beta) {
      return { result, retries, timedOut: false };
    }
    retries += 1;
    if (retries > maxRetries) {
      result = search(-Infinity, Infinity);
      return { result, retries, timedOut: false };
    }
    currentWindow *= 2;
    result = search(prevScore - currentWindow, prevScore + currentWindow);
  }
}

// Test-only: validate aspiration retry logic with deterministic score sequences.
export function simulateAspirationRetriesForTest(
  scores: number[],
  prevScore: number,
  window: number,
  maxRetries: number
): number {
  let index = 0;
  const outcome = runAspirationSearch(
    prevScore,
    window,
    maxRetries,
    () => false,
    () => {
      const score = scores[Math.min(index, scores.length - 1)] ?? 0;
      index += 1;
      return { score };
    },
    (result) => result.score
  );
  return outcome.retries;
}

// Test-only helper: mirrors timed search but returns root scores + mate info.
export function findBestMoveTimedDebug(
  state: GameState,
  color: Color,
  options: TimedSearchOptions
): MateProbeReport {
  const legalMoves = options.legalMoves ?? getAllLegalMoves(state, color);
  if (legalMoves.length === 0) {
    return {
      move: null,
      score: null,
      mateInPly: null,
      mateInMoves: null,
      depthCompleted: 0,
      scoredMoves: []
    };
  }

  const now = options.now ?? defaultNow;
  const start = now();
  const shouldStop = () => {
    if (options.stopRequested && options.stopRequested()) {
      return true;
    }
    return now() - start >= options.maxTimeMs;
  };
  const tt = options.maxThinking ? options.tt ?? new Map<string, TTEntry>() : undefined;
  const ordering = options.maxThinking
    ? options.ordering ?? createOrderingState(options.maxDepth + 4)
    : undefined;
  const aspirationWindow = options.maxThinking
    ? options.aspirationWindow ?? DEFAULT_ASPIRATION_WINDOW
    : 0;
  const aspirationMaxRetries =
    options.aspirationMaxRetries ?? DEFAULT_ASPIRATION_MAX_RETRIES;
  let depthCompleted = 0;
  let bestMove: Move | null = null;
  let bestScore: number | null = null;
  let scoredMoves: MateProbeScoredMove[] = [];
  let aspirationRetries = 0;
  let prevScore: number | null = null;

  for (let depth = 1; depth <= options.maxDepth; depth += 1) {
    if (now() - start >= options.maxTimeMs) {
      break;
    }
    if (ordering && depth > 1) {
      decayHistory(ordering);
    }
    options.onDepth?.(depth);
    let scored:
      | { move: Move | null; score: number | null; scoredMoves: MateProbeScoredMove[] }
      | undefined;
    if (options.maxThinking && prevScore !== null && aspirationWindow > 0) {
      const outcome = runAspirationSearch(
        prevScore,
        aspirationWindow,
        aspirationMaxRetries,
        shouldStop,
        (alpha, beta) =>
          scoreRootMoves(
            state,
            color,
            {
              depth,
              rng: options.rng,
              legalMoves,
              playForWin: options.playForWin,
              recentPositions: options.recentPositions,
              repetitionPenalty: options.repetitionPenalty,
              topMoveWindow: options.topMoveWindow,
              fairnessWindow: options.fairnessWindow,
              maxThinking: options.maxThinking,
              tt,
              ordering
            },
            { alpha, beta },
            shouldStop
          ),
        (result) => result.score
      );
      aspirationRetries += outcome.retries;
      scored = outcome.result;
    } else {
      scored = scoreRootMoves(
        state,
        color,
        {
          depth,
          rng: options.rng,
          legalMoves,
          playForWin: options.playForWin,
          recentPositions: options.recentPositions,
          repetitionPenalty: options.repetitionPenalty,
          topMoveWindow: options.topMoveWindow,
          fairnessWindow: options.fairnessWindow,
          maxThinking: options.maxThinking,
          tt,
          ordering
        },
        undefined,
        shouldStop
      );
    }
    if (!scored) {
      scored = {
        move: null,
        score: null,
        scoredMoves: []
      };
    }
    if (scored.move) {
      bestMove = scored.move;
      bestScore = scored.score;
      scoredMoves = scored.scoredMoves;
      depthCompleted = depth;
      prevScore = scored.score;
    }
  }

  if (!bestMove) {
    const scored = scoreRootMoves(
      state,
      color,
      {
        depth: 1,
        rng: options.rng,
        legalMoves,
        playForWin: options.playForWin,
        recentPositions: options.recentPositions,
        repetitionPenalty: options.repetitionPenalty,
        topMoveWindow: options.topMoveWindow,
        fairnessWindow: options.fairnessWindow,
        maxThinking: options.maxThinking,
        tt,
        ordering
      },
      undefined,
      shouldStop
    );
    bestMove = scored.move;
    bestScore = scored.score;
    scoredMoves = scored.scoredMoves;
    depthCompleted = 1;
  }

  const mateInfo = bestScore !== null ? getMateInfo(bestScore) : null;
  return {
    move: bestMove,
    score: bestScore,
    mateInPly: mateInfo?.mateInPly ?? null,
    mateInMoves: mateInfo?.mateInMoves ?? null,
    depthCompleted,
    scoredMoves,
    ttEntries: tt?.size,
    aspirationRetries
  };
}

function scoreRootMoves(
  state: GameState,
  color: Color,
  options: SearchOptions,
  window?: { alpha: number; beta: number },
  shouldStop?: () => boolean
): { move: Move | null; score: number | null; scoredMoves: MateProbeScoredMove[] } {
  const ordered = orderMoves(state, options.legalMoves ?? [], color, options.rng, {
    preferred: options.maxThinking && options.tt
      ? options.tt.get(getPositionKey(state))?.bestMove
      : undefined,
    maxThinking: options.maxThinking,
    ordering: options.ordering,
    ply: 0
  });
  const alpha = window?.alpha ?? -Infinity;
  const beta = window?.beta ?? Infinity;
  const scoredMoves: MateProbeScoredMove[] = [];
  const playForWin = Boolean(options.playForWin && options.recentPositions?.length);
  const repetitionPenalty = options.repetitionPenalty ?? DEFAULT_REPETITION_PENALTY;
  const topMoveWindow = options.topMoveWindow ?? DEFAULT_TOP_MOVE_WINDOW;
  const fairnessWindow = options.fairnessWindow ?? DEFAULT_FAIRNESS_WINDOW;

  let bestMoveSoFar: Move | null = ordered[0] ?? null;
  let bestScoreSoFar: number | null = null;
  for (const move of ordered) {
    if (shouldStop && shouldStop()) {
      return { move: bestMoveSoFar, score: bestScoreSoFar, scoredMoves };
    }
    const next = cloneState(state);
    next.activeColor = color;
    applyMove(next, move);

    let baseScore = alphaBeta(
      next,
      options.depth - 1,
      alpha,
      beta,
      opponentColor(color),
      color,
      options.rng,
      options.maxThinking ?? false,
      1,
      options.tt,
      options.ordering,
      shouldStop
    );
    let score = baseScore;

    if (playForWin) {
      const key = getPositionKey(next);
      if (options.recentPositions?.includes(key)) {
        score -= repetitionPenalty;
      }
    }

    const mateInfo = getMateInfo(score);
    scoredMoves.push({
      move,
      score,
      baseScore,
      mateInPly: mateInfo?.mateInPly ?? null,
      mateInMoves: mateInfo?.mateInMoves ?? null
    });
    if (bestScoreSoFar === null || score > bestScoreSoFar) {
      bestScoreSoFar = score;
      bestMoveSoFar = move;
    }
  }

  if (scoredMoves.length === 0) {
    return { move: null, score: null, scoredMoves };
  }

  const bestScore = Math.max(...scoredMoves.map((entry) => entry.score));
  const baseBest = Math.max(...scoredMoves.map((entry) => entry.baseScore));
  let windowed =
    playForWin && topMoveWindow > 0
      ? scoredMoves.filter((entry) => entry.score >= bestScore - topMoveWindow)
      : scoredMoves.filter((entry) => entry.score === bestScore);

  if (playForWin) {
    windowed = windowed.filter((entry) => entry.baseScore >= baseBest - fairnessWindow);
    if (windowed.length === 0) {
      const baseLeaders = scoredMoves.filter((entry) => entry.baseScore === baseBest);
      const index = Math.floor(options.rng() * baseLeaders.length);
      return { move: baseLeaders[index].move, score: baseLeaders[index].score, scoredMoves };
    }
  }

  const index = Math.floor(options.rng() * windowed.length);
  return { move: windowed[index].move, score: windowed[index].score, scoredMoves };
}

function getMateInfo(score: number): { mateInPly: number; mateInMoves: number } | null {
  const abs = Math.abs(score);
  if (abs < MATE_SCORE - 100) {
    return null;
  }
  const mateInPly = Math.max(0, MATE_SCORE - abs);
  const mateInMoves = Math.ceil(mateInPly / 2);
  return { mateInPly, mateInMoves };
}

function defaultNow(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function alphaBeta(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  currentColor: Color,
  maximizingColor: Color,
  rng: () => number,
  maxThinking: boolean,
  ply: number,
  tt?: Map<string, TTEntry>,
  ordering?: OrderingState,
  stopChecker?: () => boolean
): number {
  if (stopChecker && stopChecker()) {
    return evaluateState(state, maximizingColor, { maxThinking });
  }
  const legalMoves = getAllLegalMoves(state, currentColor);
  const alphaOrig = alpha;
  const betaOrig = beta;
  let key: string | null = null;
  let ttBestMove: Move | undefined;

  if (maxThinking && tt) {
    key = getPositionKey(state);
    const cached = tt.get(key);
    if (cached && cached.depth >= depth) {
      if (cached.flag === 'exact') {
        return cached.score;
      }
      if (cached.flag === 'alpha' && cached.score <= alpha) {
        return cached.score;
      }
      if (cached.flag === 'beta' && cached.score >= beta) {
        return cached.score;
      }
    }
    ttBestMove = cached?.bestMove;
  }

  if (legalMoves.length === 0) {
    if (isInCheck(state, currentColor)) {
      return maxThinking
        ? mateScore(currentColor, maximizingColor, ply)
        : currentColor === maximizingColor
          ? -MATE_SCORE
          : MATE_SCORE;
    }
    return 0;
  }

  if (depth <= 0) {
    if (!maxThinking) {
      return evaluateState(state, maximizingColor, { maxThinking });
    }
    return quiescence(
      state,
      alpha,
      beta,
      currentColor,
      maximizingColor,
      rng,
      ply,
      0,
      stopChecker
    );
  }

  const maximizing = currentColor === maximizingColor;
  const inCheck = maxThinking ? isInCheck(state, currentColor) : false;

  if (
    maxThinking &&
    depth >= NULL_MOVE_MIN_DEPTH &&
    !inCheck &&
    shouldAllowNullMove(state, currentColor)
  ) {
    const next = cloneState(state);
    next.activeColor = opponentColor(currentColor);
    next.enPassantTarget = null;
    const reductionDepth = Math.max(0, depth - 1 - NULL_MOVE_REDUCTION);
    const nullScore = alphaBeta(
      next,
      reductionDepth,
      alpha,
      beta,
      opponentColor(currentColor),
      maximizingColor,
      rng,
      maxThinking,
      ply + 1,
      tt,
      ordering,
      stopChecker
    );
    if (maximizing) {
      if (nullScore >= beta) {
        return nullScore;
      }
    } else if (nullScore <= alpha) {
      return nullScore;
    }
  }

  const ordered = orderMoves(state, legalMoves, currentColor, rng, {
    preferred: ttBestMove,
    maxThinking,
    ordering,
    ply
  });

  if (maximizing) {
    let value = -Infinity;
    let bestMove: Move | undefined;
    for (let index = 0; index < ordered.length; index += 1) {
      if (stopChecker && stopChecker()) {
        return value;
      }
      const move = ordered[index];
      const next = cloneState(state);
      next.activeColor = currentColor;
      applyMove(next, move);
      const reduction = maxThinking
        ? getLmrReduction(depth, index, inCheck, isQuietForLmr(state, move, currentColor))
        : 0;
      const reducedDepth = Math.max(0, depth - 1 - reduction);
      let nextScore = alphaBeta(
        next,
        reducedDepth,
        alpha,
        beta,
        opponentColor(currentColor),
        maximizingColor,
        rng,
        maxThinking,
        ply + 1,
        tt,
        ordering,
        stopChecker
      );
      if (reduction > 0 && reducedDepth < depth - 1 && nextScore > alpha) {
        nextScore = alphaBeta(
          next,
          depth - 1,
          alpha,
          beta,
          opponentColor(currentColor),
          maximizingColor,
          rng,
          maxThinking,
          ply + 1,
          tt,
          ordering,
          stopChecker
        );
      }
      if (stopChecker && stopChecker()) {
        return value;
      }
      if (nextScore > value) {
        value = nextScore;
        bestMove = move;
      }
      alpha = Math.max(alpha, value);
      if (alpha >= beta) {
        if (maxThinking && ordering && isQuietForOrdering(state, move, currentColor)) {
          recordKiller(ordering, ply, move);
          recordHistory(ordering, move, depth);
        }
        break;
      }
    }
    if (maxThinking && tt && key) {
      tt.set(key, {
        depth,
        score: value,
        flag: value <= alphaOrig ? 'alpha' : value >= betaOrig ? 'beta' : 'exact',
        bestMove
      });
    }
    return value;
  }

  let value = Infinity;
  let bestMove: Move | undefined;
  for (let index = 0; index < ordered.length; index += 1) {
    if (stopChecker && stopChecker()) {
      return value;
    }
    const move = ordered[index];
    const next = cloneState(state);
    next.activeColor = currentColor;
    applyMove(next, move);
    const reduction = maxThinking
      ? getLmrReduction(depth, index, inCheck, isQuietForLmr(state, move, currentColor))
      : 0;
    const reducedDepth = Math.max(0, depth - 1 - reduction);
    let nextScore = alphaBeta(
      next,
      reducedDepth,
      alpha,
      beta,
      opponentColor(currentColor),
      maximizingColor,
      rng,
      maxThinking,
      ply + 1,
      tt,
      ordering,
      stopChecker
    );
    if (reduction > 0 && reducedDepth < depth - 1 && nextScore < beta) {
      nextScore = alphaBeta(
        next,
        depth - 1,
        alpha,
        beta,
        opponentColor(currentColor),
        maximizingColor,
        rng,
        maxThinking,
        ply + 1,
        tt,
        ordering,
        stopChecker
      );
    }
    if (stopChecker && stopChecker()) {
      return value;
    }
    if (nextScore < value) {
      value = nextScore;
      bestMove = move;
    }
    beta = Math.min(beta, value);
    if (alpha >= beta) {
      if (maxThinking && ordering && isQuietForOrdering(state, move, currentColor)) {
        recordKiller(ordering, ply, move);
        recordHistory(ordering, move, depth);
      }
      break;
    }
  }
  if (maxThinking && tt && key) {
    tt.set(key, {
      depth,
      score: value,
      flag: value <= alphaOrig ? 'alpha' : value >= betaOrig ? 'beta' : 'exact',
      bestMove
    });
  }
  return value;
}

function orderMoves(
  state: GameState,
  moves: Move[],
  color: Color,
  rng: () => number,
  options?: { preferred?: Move; maxThinking?: boolean; ordering?: OrderingState; ply?: number }
): Move[] {
  const preferred = options?.preferred;
  const maxThinking = options?.maxThinking ?? false;
  const ordering = options?.ordering;
  const ply = options?.ply ?? 0;
  const scored = moves.map((move, index) => ({
    move,
    score: buildOrderScore(state, move, color, maxThinking, {
      preferred,
      ordering,
      ply
    }),
    tie: maxThinking ? index : rng()
  }));

  scored.sort((a, b) => b.score - a.score || a.tie - b.tie);
  return scored.map((entry) => entry.move);
}

export function orderMovesForTest(
  state: GameState,
  moves: Move[],
  color: Color,
  rng: () => number,
  options?: { preferred?: Move; maxThinking?: boolean; ordering?: OrderingState; ply?: number }
): Move[] {
  return orderMoves(state, moves, color, rng, options);
}

function scoreMoveHeuristic(
  state: GameState,
  move: Move,
  color: Color,
  maxThinking: boolean
): number {
  const movingPiece = getPieceAt(state, move.from);
  const movedValue = movingPiece ? PIECE_VALUES[movingPiece.type] : 0;

  let score = 0;

  if (move.promotion) {
    score += PIECE_VALUES[move.promotion] - PIECE_VALUES.pawn;
  }

  const capturedValue = getCaptureValue(state, move);
  score += capturedValue;

  const next = cloneState(state);
  next.activeColor = color;
  applyMove(next, move);

  const givesCheck = isInCheck(next, opponentColor(color));
  const hanging = isMovedPieceHanging(next, move, color);

  if (givesCheck && !hanging) {
    score += 40;
  }

  if (maxThinking) {
    if (capturedValue > 0) {
      score += capturedValue * 10 - movedValue;
      const seeNet = seeLiteNet(state, move, color);
      if (seeNet <= SEE_ORDER_PENALTY_THRESHOLD) {
        score -= SEE_ORDER_PENALTY_BASE + Math.abs(seeNet);
      }
    }
    if (givesCheck) {
      score += 60;
    }
  }

  if (hanging) {
    score -= movedValue * 0.75;
  }

  if (movingPiece && (movingPiece.type === 'knight' || movingPiece.type === 'bishop')) {
    const startRank = color === 'w' ? 0 : 7;
    if (state.fullmoveNumber <= 4 && move.from.rank === startRank && move.to.rank !== startRank) {
      score += 15;
    }
  }

  return score;
}

function buildOrderScore(
  state: GameState,
  move: Move,
  color: Color,
  maxThinking: boolean,
  options: { preferred?: Move; ordering?: OrderingState; ply: number }
): number {
  let score = scoreMoveHeuristic(state, move, color, maxThinking);

  if (options.preferred && sameMove(move, options.preferred)) {
    score += 100000;
  }

  if (maxThinking && options.ordering) {
    const killerScore = getKillerScore(options.ordering, options.ply, move);
    const historyScore = isQuietForOrdering(state, move, color)
      ? Math.min(getHistoryScore(options.ordering, move), 1000)
      : 0;
    score += killerScore + historyScore;
  }

  return score;
}

function getKillerScore(ordering: OrderingState, ply: number, move: Move): number {
  const slot = ordering.killerMoves[ply];
  if (!slot) {
    return 0;
  }
  if (slot.primary && sameMove(slot.primary, move)) {
    return 3000;
  }
  if (slot.secondary && sameMove(slot.secondary, move)) {
    return 2000;
  }
  return 0;
}

function getHistoryScore(ordering: OrderingState, move: Move): number {
  return ordering.history[getHistoryIndex(move)] ?? 0;
}

function recordKiller(ordering: OrderingState, ply: number, move: Move): void {
  if (!ordering.killerMoves[ply]) {
    ordering.killerMoves[ply] = {};
  }
  const slot = ordering.killerMoves[ply];
  if (slot.primary && sameMove(slot.primary, move)) {
    return;
  }
  slot.secondary = slot.primary;
  slot.primary = move;
}

function recordHistory(ordering: OrderingState, move: Move, depth: number): void {
  const index = getHistoryIndex(move);
  ordering.history[index] = Math.min(ordering.history[index] + depth * depth, 50000);
}

function decayHistory(ordering: OrderingState): void {
  for (let i = 0; i < ordering.history.length; i += 1) {
    ordering.history[i] = Math.floor(ordering.history[i] * 0.9);
  }
}

function getHistoryIndex(move: Move): number {
  const from = move.from.rank * 8 + move.from.file;
  const to = move.to.rank * 8 + move.to.file;
  return from * 64 + to;
}

function quiescence(
  state: GameState,
  alpha: number,
  beta: number,
  currentColor: Color,
  maximizingColor: Color,
  rng: () => number,
  ply: number,
  qDepth: number,
  stopChecker?: () => boolean
): number {
  if (stopChecker && stopChecker()) {
    return evaluateState(state, maximizingColor, { maxThinking: true });
  }
  const legalMoves = getAllLegalMoves(state, currentColor);
  if (legalMoves.length === 0) {
    if (isInCheck(state, currentColor)) {
      return mateScore(currentColor, maximizingColor, ply);
    }
    return 0;
  }

  const standPat = evaluateState(state, maximizingColor, { maxThinking: true });
  const maximizing = currentColor === maximizingColor;

  if (maximizing) {
    if (standPat >= beta) {
      return standPat;
    }
    alpha = Math.max(alpha, standPat);
  } else {
    if (standPat <= alpha) {
      return standPat;
    }
    beta = Math.min(beta, standPat);
  }

  if (qDepth >= QUIESCENCE_MAX_DEPTH) {
    return standPat;
  }

  const noisyMoves = legalMoves.filter(
    (move) => isCaptureMove(state, move) || givesCheck(state, move, currentColor)
  );
  if (noisyMoves.length === 0) {
    return standPat;
  }

  const filtered = noisyMoves.filter(
    (move) => !shouldPruneCapture(state, move, currentColor)
  );
  if (filtered.length === 0) {
    return standPat;
  }

  const ordered = orderMoves(state, filtered, currentColor, rng, {
    maxThinking: true
  });

  if (maximizing) {
    let value = standPat;
    for (const move of ordered) {
      if (stopChecker && stopChecker()) {
        return value;
      }
      const next = cloneState(state);
      next.activeColor = currentColor;
      applyMove(next, move);
      value = Math.max(
        value,
        quiescence(
          next,
          alpha,
          beta,
          opponentColor(currentColor),
          maximizingColor,
          rng,
          ply + 1,
          qDepth + 1,
          stopChecker
        )
      );
      if (stopChecker && stopChecker()) {
        return value;
      }
      alpha = Math.max(alpha, value);
      if (alpha >= beta) {
        break;
      }
    }
    return value;
  }

  let value = standPat;
  for (const move of ordered) {
    if (stopChecker && stopChecker()) {
      return value;
    }
    const next = cloneState(state);
    next.activeColor = currentColor;
    applyMove(next, move);
    value = Math.min(
      value,
      quiescence(
        next,
        alpha,
        beta,
        opponentColor(currentColor),
        maximizingColor,
        rng,
        ply + 1,
        qDepth + 1,
        stopChecker
      )
    );
    if (stopChecker && stopChecker()) {
      return value;
    }
    beta = Math.min(beta, value);
    if (alpha >= beta) {
      break;
    }
  }
  return value;
}

function isCaptureMove(state: GameState, move: Move): boolean {
  if (move.capturedId || move.isEnPassant) {
    return true;
  }
  const target = getPieceAt(state, move.to);
  return Boolean(target);
}

function shouldPruneCapture(state: GameState, move: Move, color: Color): boolean {
  if (!isCaptureMove(state, move)) {
    return false;
  }
  if (givesCheck(state, move, color)) {
    return false;
  }
  const net = seeLiteNet(state, move, color);
  return net <= SEE_QUIESCENCE_PRUNE_THRESHOLD;
}

function getLmrReduction(
  depth: number,
  moveIndex: number,
  inCheck: boolean,
  isQuiet: boolean
): number {
  if (depth < LMR_MIN_DEPTH) {
    return 0;
  }
  if (moveIndex < LMR_START_MOVE) {
    return 0;
  }
  if (inCheck || !isQuiet) {
    return 0;
  }
  return LMR_REDUCTION;
}

function shouldAllowNullMove(state: GameState, color: Color): boolean {
  let totalMaterial = 0;
  let hasNonPawnForSide = false;
  for (const piece of state.pieces.values()) {
    if (piece.type === 'king') {
      continue;
    }
    totalMaterial += PIECE_VALUES[piece.type];
    if (piece.color === color && piece.type !== 'pawn') {
      hasNonPawnForSide = true;
    }
  }
  if (!hasNonPawnForSide) {
    return false;
  }
  if (totalMaterial < NULL_MOVE_MIN_MATERIAL) {
    return false;
  }
  return true;
}

function isQuietForOrdering(state: GameState, move: Move, color: Color): boolean {
  if (move.isCastle || move.promotion) {
    return false;
  }
  if (isCaptureMove(state, move)) {
    return false;
  }
  return !givesCheck(state, move, color);
}

function isQuietForLmr(state: GameState, move: Move, color: Color): boolean {
  return isQuietForOrdering(state, move, color);
}

function givesCheck(state: GameState, move: Move, color: Color): boolean {
  const next = cloneState(state);
  next.activeColor = color;
  applyMove(next, move);
  return isInCheck(next, opponentColor(color));
}

function getCaptureValue(state: GameState, move: Move): number {
  if (move.capturedId) {
    const captured = state.pieces.get(move.capturedId);
    return captured ? PIECE_VALUES[captured.type] : 0;
  }
  if (move.isEnPassant) {
    return PIECE_VALUES.pawn;
  }
  return 0;
}

function seeLiteNet(state: GameState, move: Move, color: Color): number {
  const movingPiece = getPieceAt(state, move.from);
  const capturedValue = getCaptureValue(state, move);
  if (!movingPiece || capturedValue === 0) {
    return 0;
  }
  const attackerValue = PIECE_VALUES[movingPiece.type];
  const next = cloneState(state);
  next.activeColor = color;
  applyMove(next, move);

  const movedId = next.board[move.to.rank]?.[move.to.file];
  if (!movedId) {
    return capturedValue - attackerValue;
  }

  const opponentMoves = getAllLegalMoves(next, opponentColor(color));
  let defenderValue = 0;
  for (const reply of opponentMoves) {
    if (reply.capturedId !== movedId) {
      continue;
    }
    const defender = getPieceAt(next, reply.from);
    if (!defender) {
      continue;
    }
    const value = PIECE_VALUES[defender.type];
    if (defenderValue === 0 || value < defenderValue) {
      defenderValue = value;
    }
  }

  return capturedValue - attackerValue - defenderValue;
}

function isMovedPieceHanging(state: GameState, move: Move, color: Color): boolean {
  const movedId = state.board[move.to.rank]?.[move.to.file];
  if (!movedId) {
    return false;
  }
  const opponentMoves = getAllLegalMoves(state, opponentColor(color));
  return opponentMoves.some((candidate) => candidate.capturedId === movedId);
}

function opponentColor(color: Color): Color {
  return color === 'w' ? 'b' : 'w';
}

function sameMove(a: Move, b: Move): boolean {
  return (
    a.from.file === b.from.file &&
    a.from.rank === b.from.rank &&
    a.to.file === b.to.file &&
    a.to.rank === b.to.rank &&
    a.promotion === b.promotion &&
    a.isCastle === b.isCastle &&
    a.isEnPassant === b.isEnPassant
  );
}

function mateScore(currentColor: Color, maximizingColor: Color, ply: number): number {
  const sign = currentColor === maximizingColor ? -1 : 1;
  return sign * (MATE_SCORE - ply);
}

// Test-only helpers for SEE-lite assertions.
export function seeLiteNetForTest(state: GameState, move: Move, color: Color): number {
  return seeLiteNet(state, move, color);
}

export function shouldPruneCaptureForTest(
  state: GameState,
  move: Move,
  color: Color
): boolean {
  return shouldPruneCapture(state, move, color);
}

export function getLmrReductionForTest(
  depth: number,
  moveIndex: number,
  inCheck: boolean,
  isQuiet: boolean
): number {
  return getLmrReduction(depth, moveIndex, inCheck, isQuiet);
}

export function shouldAllowNullMoveForTest(state: GameState, color: Color): boolean {
  return shouldAllowNullMove(state, color);
}

function cloneState(state: GameState): GameState {
  const board = state.board.map((row) => row.slice());
  const clonedPieces = new Map<number, Piece>();
  for (const [id, piece] of state.pieces) {
    clonedPieces.set(id, { ...piece });
  }
  return {
    board,
    pieces: clonedPieces,
    activeColor: state.activeColor,
    castlingRights: { ...state.castlingRights },
    enPassantTarget: state.enPassantTarget ? { ...state.enPassantTarget } : null,
    halfmoveClock: state.halfmoveClock,
    fullmoveNumber: state.fullmoveNumber,
    lastMove: state.lastMove ? cloneMove(state.lastMove) : null
  };
}

function cloneMove(move: Move): Move {
  return {
    from: { ...move.from },
    to: { ...move.to },
    promotion: move.promotion,
    isCastle: move.isCastle,
    isEnPassant: move.isEnPassant,
    capturedId: move.capturedId
  };
}
