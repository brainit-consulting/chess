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
};

const MATE_SCORE = 20000;
const DEFAULT_REPETITION_PENALTY = 15;
const DEFAULT_TOP_MOVE_WINDOW = 10;
const DEFAULT_FAIRNESS_WINDOW = 25;

type TimedSearchOptions = Omit<SearchOptions, 'depth'> & {
  maxDepth: number;
  maxTimeMs: number;
  now?: () => number;
  onDepth?: (depth: number) => void;
};

export function findBestMove(state: GameState, color: Color, options: SearchOptions): Move | null {
  const legalMoves = options.legalMoves ?? getAllLegalMoves(state, color);
  if (legalMoves.length === 0) {
    return null;
  }

  const ordered = orderMoves(state, legalMoves, color, options.rng);
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
      options.maxThinking ?? false
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
      maxThinking: options.maxThinking
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
    maxThinking: options.maxThinking
  });
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
  maxThinking: boolean
): number {
  const legalMoves = getAllLegalMoves(state, currentColor);
  if (legalMoves.length === 0) {
    if (isInCheck(state, currentColor)) {
      return currentColor === maximizingColor ? -MATE_SCORE : MATE_SCORE;
    }
    return 0;
  }

  if (depth <= 0) {
    return evaluateState(state, maximizingColor, { maxThinking });
  }

  const ordered = orderMoves(state, legalMoves, currentColor, rng);
  const maximizing = currentColor === maximizingColor;

  if (maximizing) {
    let value = -Infinity;
    for (const move of ordered) {
      const next = cloneState(state);
      next.activeColor = currentColor;
      applyMove(next, move);
      value = Math.max(
        value,
        alphaBeta(
          next,
          depth - 1,
          alpha,
          beta,
          opponentColor(currentColor),
          maximizingColor,
          rng,
          maxThinking
        )
      );
      alpha = Math.max(alpha, value);
      if (alpha >= beta) {
        break;
      }
    }
    return value;
  }

  let value = Infinity;
  for (const move of ordered) {
    const next = cloneState(state);
    next.activeColor = currentColor;
    applyMove(next, move);
    value = Math.min(
      value,
      alphaBeta(
        next,
        depth - 1,
        alpha,
        beta,
        opponentColor(currentColor),
        maximizingColor,
        rng,
        maxThinking
      )
    );
    beta = Math.min(beta, value);
    if (alpha >= beta) {
      break;
    }
  }
  return value;
}

function orderMoves(
  state: GameState,
  moves: Move[],
  color: Color,
  rng: () => number
): Move[] {
  const scored = moves.map((move) => ({
    move,
    score: scoreMoveHeuristic(state, move, color),
    tie: rng()
  }));

  scored.sort((a, b) => b.score - a.score || a.tie - b.tie);
  return scored.map((entry) => entry.move);
}

function scoreMoveHeuristic(state: GameState, move: Move, color: Color): number {
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
