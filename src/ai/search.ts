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
};

const MATE_SCORE = 20000;
const DEFAULT_REPETITION_PENALTY = 15;
const DEFAULT_TOP_MOVE_WINDOW = 10;
const DEFAULT_FAIRNESS_WINDOW = 25;
const QUIESCENCE_MAX_DEPTH = 4;

type TTFlag = 'exact' | 'alpha' | 'beta';

type TTEntry = {
  depth: number;
  score: number;
  flag: TTFlag;
  bestMove?: Move;
};

type TimedSearchOptions = Omit<SearchOptions, 'depth'> & {
  maxDepth: number;
  maxTimeMs: number;
  now?: () => number;
  onDepth?: (depth: number) => void;
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
};

export function findBestMove(state: GameState, color: Color, options: SearchOptions): Move | null {
  const legalMoves = options.legalMoves ?? getAllLegalMoves(state, color);
  if (legalMoves.length === 0) {
    return null;
  }

  const preferred =
    options.maxThinking && options.tt
      ? options.tt.get(getPositionKey(state))?.bestMove
      : undefined;
  const ordered = orderMoves(state, legalMoves, color, options.rng, {
    preferred,
    maxThinking: options.maxThinking
  });
  const scoredMoves: { move: Move; score: number; baseScore: number }[] = [];
  const playForWin = Boolean(options.playForWin && options.recentPositions?.length);
  const repetitionPenalty = options.repetitionPenalty ?? DEFAULT_REPETITION_PENALTY;
  const topMoveWindow = options.topMoveWindow ?? DEFAULT_TOP_MOVE_WINDOW;
  const fairnessWindow = options.fairnessWindow ?? DEFAULT_FAIRNESS_WINDOW;

  for (const move of ordered) {
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
      options.tt
    );
    let score = baseScore;

    if (playForWin) {
      const key = getPositionKey(next);
      if (options.recentPositions?.includes(key)) {
        score -= repetitionPenalty;
      }
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
  let best: Move | null = null;
  const tt = options.maxThinking ? options.tt ?? new Map<string, TTEntry>() : undefined;

  for (let depth = 1; depth <= options.maxDepth; depth += 1) {
    if (now() - start >= options.maxTimeMs) {
      break;
    }
    options.onDepth?.(depth);
    const move = findBestMove(state, color, {
      depth,
      rng: options.rng,
      legalMoves,
      playForWin: options.playForWin,
      recentPositions: options.recentPositions,
      repetitionPenalty: options.repetitionPenalty,
      topMoveWindow: options.topMoveWindow,
      fairnessWindow: options.fairnessWindow,
      maxThinking: options.maxThinking,
      tt
    });
    if (move) {
      best = move;
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
    tt
  });
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
  const tt = options.maxThinking ? options.tt ?? new Map<string, TTEntry>() : undefined;
  let depthCompleted = 0;
  let bestMove: Move | null = null;
  let bestScore: number | null = null;
  let scoredMoves: MateProbeScoredMove[] = [];

  for (let depth = 1; depth <= options.maxDepth; depth += 1) {
    if (now() - start >= options.maxTimeMs) {
      break;
    }
    options.onDepth?.(depth);
    const scored = scoreRootMoves(state, color, {
      depth,
      rng: options.rng,
      legalMoves,
      playForWin: options.playForWin,
      recentPositions: options.recentPositions,
      repetitionPenalty: options.repetitionPenalty,
      topMoveWindow: options.topMoveWindow,
      fairnessWindow: options.fairnessWindow,
      maxThinking: options.maxThinking,
      tt
    });
    if (scored.move) {
      bestMove = scored.move;
      bestScore = scored.score;
      scoredMoves = scored.scoredMoves;
      depthCompleted = depth;
    }
  }

  if (!bestMove) {
    const scored = scoreRootMoves(state, color, {
      depth: 1,
      rng: options.rng,
      legalMoves,
      playForWin: options.playForWin,
      recentPositions: options.recentPositions,
      repetitionPenalty: options.repetitionPenalty,
      topMoveWindow: options.topMoveWindow,
      fairnessWindow: options.fairnessWindow,
      maxThinking: options.maxThinking,
      tt
    });
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
    ttEntries: tt?.size
  };
}

function scoreRootMoves(
  state: GameState,
  color: Color,
  options: SearchOptions
): { move: Move | null; score: number | null; scoredMoves: MateProbeScoredMove[] } {
  const ordered = orderMoves(state, options.legalMoves ?? [], color, options.rng, {
    preferred: options.maxThinking && options.tt
      ? options.tt.get(getPositionKey(state))?.bestMove
      : undefined,
    maxThinking: options.maxThinking
  });
  const scoredMoves: MateProbeScoredMove[] = [];
  const playForWin = Boolean(options.playForWin && options.recentPositions?.length);
  const repetitionPenalty = options.repetitionPenalty ?? DEFAULT_REPETITION_PENALTY;
  const topMoveWindow = options.topMoveWindow ?? DEFAULT_TOP_MOVE_WINDOW;
  const fairnessWindow = options.fairnessWindow ?? DEFAULT_FAIRNESS_WINDOW;

  for (const move of ordered) {
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
      options.tt
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
  tt?: Map<string, TTEntry>
): number {
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
      0
    );
  }

  const ordered = orderMoves(state, legalMoves, currentColor, rng, {
    preferred: ttBestMove,
    maxThinking
  });
  const maximizing = currentColor === maximizingColor;

  if (maximizing) {
    let value = -Infinity;
    let bestMove: Move | undefined;
    for (const move of ordered) {
      const next = cloneState(state);
      next.activeColor = currentColor;
      applyMove(next, move);
      const nextScore = alphaBeta(
        next,
        depth - 1,
        alpha,
        beta,
        opponentColor(currentColor),
        maximizingColor,
        rng,
        maxThinking,
        ply + 1,
        tt
      );
      if (nextScore > value) {
        value = nextScore;
        bestMove = move;
      }
      alpha = Math.max(alpha, value);
      if (alpha >= beta) {
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
  for (const move of ordered) {
    const next = cloneState(state);
    next.activeColor = currentColor;
    applyMove(next, move);
    const nextScore = alphaBeta(
      next,
      depth - 1,
      alpha,
      beta,
      opponentColor(currentColor),
      maximizingColor,
      rng,
      maxThinking,
      ply + 1,
      tt
    );
    if (nextScore < value) {
      value = nextScore;
      bestMove = move;
    }
    beta = Math.min(beta, value);
    if (alpha >= beta) {
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
  options?: { preferred?: Move; maxThinking?: boolean }
): Move[] {
  const preferred = options?.preferred;
  const maxThinking = options?.maxThinking ?? false;
  const scored = moves.map((move) => ({
    move,
    score:
      scoreMoveHeuristic(state, move, color, maxThinking) +
      (preferred && sameMove(move, preferred) ? 100000 : 0),
    tie: rng()
  }));

  scored.sort((a, b) => b.score - a.score || a.tie - b.tie);
  return scored.map((entry) => entry.move);
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

function quiescence(
  state: GameState,
  alpha: number,
  beta: number,
  currentColor: Color,
  maximizingColor: Color,
  rng: () => number,
  ply: number,
  qDepth: number
): number {
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

  const ordered = orderMoves(state, noisyMoves, currentColor, rng, {
    maxThinking: true
  });

  if (maximizing) {
    let value = standPat;
    for (const move of ordered) {
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
          qDepth + 1
        )
      );
      alpha = Math.max(alpha, value);
      if (alpha >= beta) {
        break;
      }
    }
    return value;
  }

  let value = standPat;
  for (const move of ordered) {
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
        qDepth + 1
      )
    );
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
