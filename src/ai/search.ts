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
  repetitionPenaltyScale?: number;
  hardRepetitionNudgeScale?: number;
  contemptCp?: number;
  microQuiescenceDepth?: number;
  topMoveWindow?: number;
  fairnessWindow?: number;
  maxThinking?: boolean;
  repetitionAvoidWindow?: number;
  repeatBanWindowCp?: number;
  drawHoldThreshold?: number;
  twoPlyRepeatPenalty?: number;
  twoPlyRepeatTopN?: number;
  rootDiagnostics?: boolean;
  usePvs?: boolean;
  tt?: TtStore;
  ordering?: OrderingState;
  maxTimeMs?: number;
  now?: () => number;
  stopRequested?: () => boolean;
};

const MATE_SCORE = 20000;
const DEFAULT_REPETITION_PENALTY = 15;
const REPETITION_SLIGHT_ADVANTAGE = 20;
const REPETITION_STRONG_ADVANTAGE = 120;
const REPETITION_CLEAR_DISADVANTAGE = -120;
const REPETITION_STRONG_MULTIPLIER = 3;
const REPETITION_SLIGHT_MULTIPLIER = 1;
const REPETITION_NEUTRAL_MULTIPLIER = 0.5;
const REPETITION_LOOP_MULTIPLIER = 1.5;
const REPETITION_NEAR_MULTIPLIER = 1;
const REPETITION_TWOFOLD_MULTIPLIER = 2.2;
const REPETITION_THREEFOLD_MULTIPLIER = 4;
const REPETITION_TIEBREAK_WINDOW = 15;
const REPETITION_HARD_NUDGE_ADVANTAGE = 30;
const REPETITION_HARD_NUDGE_WINDOW = 10;
const REPETITION_HARD_NUDGE_THREEFOLD_MULTIPLIER = 1.5;
const REPETITION_ESCAPE_MARGIN = 150;
const REPETITION_AVOID_LOSS_THRESHOLD = -200;
const DRAW_HOLD_THRESHOLD_DEFAULT = -80;
const TWO_PLY_REPEAT_TOP_N_DEFAULT = 6;
const ROOT_DIAGNOSTICS_TOP_N = 5;
const HARD_TT_SIZE = 4096;
const HARD_MICRO_QUIESCENCE_MAX_DEPTH = 2;
const FORCING_EXTENSION_MAX_DEPTH = 2;
const FORCING_EXTENSION_MAX_PLY = 6;
const DEFAULT_TOP_MOVE_WINDOW = 10;
const DEFAULT_FAIRNESS_WINDOW = 25;
const DEFAULT_ASPIRATION_WINDOW = 35;
const DEFAULT_ASPIRATION_MAX_RETRIES = 3;
const SEE_ORDER_PENALTY_THRESHOLD = -200;
const SEE_ORDER_PENALTY_BASE = 400;
const SEE_QUIESCENCE_PRUNE_THRESHOLD = -350;
const COUNTERMOVE_BONUS = 900;
const HARD_HISTORY_BONUS_CAP = 250;
const MAX_HISTORY_BONUS_CAP = 1000;
const CHECK_EVASION_CAPTURE_BONUS = 2000;
const CHECK_EVASION_BLOCK_BONUS = 1000;
const CHECK_EVASION_KING_MOVE_PENALTY = 200;
const CHECK_EVASION_KING_INTO_ATTACK_PENALTY = 800;
const PROGRESS_BONUS_MINOR = 6;
const PROGRESS_BONUS_CASTLE = 8;
const PROGRESS_BONUS_KING_SAFETY = 4;
const PROGRESS_BONUS_PAWN = 3;
const PROGRESS_BONUS_PAWN_ADVANCED = 3;
const ROOK_SHUFFLE_PENALTY = 6;
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

type TtStore = {
  get: (key: string) => TTEntry | undefined;
  set: (key: string, entry: TTEntry) => void;
  size?: number;
};

type HardTTEntry = TTEntry & {
  key: string;
};

class HardTT implements TtStore {
  public size = 0;
  private entries: (HardTTEntry | null)[];
  private mask: number;

  constructor(size: number) {
    const capacity = Math.max(2, nextPowerOfTwo(size));
    this.entries = new Array(capacity).fill(null);
    this.mask = capacity - 1;
  }

  get(key: string): TTEntry | undefined {
    const entry = this.entries[hashPositionKey(key) & this.mask];
    if (entry && entry.key === key) {
      return entry;
    }
    return undefined;
  }

  set(key: string, entry: TTEntry): void {
    const index = hashPositionKey(key) & this.mask;
    const slot = this.entries[index];
    if (slot && slot.key === key) {
      slot.depth = entry.depth;
      slot.score = entry.score;
      slot.flag = entry.flag;
      slot.bestMove = entry.bestMove;
      return;
    }
    this.entries[index] = { ...entry, key };
    if (!slot) {
      this.size += 1;
    }
  }
}

function hashPositionKey(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

function nextPowerOfTwo(value: number): number {
  let power = 1;
  while (power < value) {
    power <<= 1;
  }
  return power;
}

export function createHardTt(): TtStore {
  return new HardTT(HARD_TT_SIZE);
}

function getTtSize(tt?: TtStore): number | undefined {
  return tt && typeof tt.size === 'number' ? tt.size : undefined;
}

type RootScore = {
  move: Move;
  baseScore: number;
  score: number;
  repeatCount: number;
  isRepeat: boolean;
};

type RootMoveReason =
  | 'repeat-best-no-close-alt'
  | 'avoid-repeat-within-window'
  | 'losing-allow-repeat'
  | 'non-repeat-best';

export type RootDiagnostics = {
  rootTopMoves: {
    move: Move;
    score: number;
    baseScore: number;
    isRepeat: boolean;
    repeatCount: number;
  }[];
  chosenMoveReason: RootMoveReason;
  bestRepeatKind: 'none' | 'near-repetition' | 'threefold';
  bestIsRepeat: boolean;
};

function buildPositionCounts(positions: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const key of positions) {
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function getRepetitionPenaltyMultiplier(score: number): number {
  if (score <= REPETITION_CLEAR_DISADVANTAGE) {
    return 0;
  }
  if (score >= REPETITION_STRONG_ADVANTAGE) {
    return REPETITION_STRONG_MULTIPLIER;
  }
  if (score >= REPETITION_SLIGHT_ADVANTAGE) {
    return REPETITION_SLIGHT_MULTIPLIER;
  }
  return REPETITION_NEUTRAL_MULTIPLIER;
}

function applyRepetitionPolicy(
  scores: RootScore[],
  options: SearchOptions,
  playForWin: boolean
): RootScore[] {
  if (!playForWin || !options.recentPositions?.length) {
    return scores;
  }
  if (scores.length <= 1) {
    return scores;
  }
  const scale = options.repetitionPenaltyScale ?? 0;
  if (scale <= 0) {
    return scores;
  }
  const drawHoldThreshold = options.drawHoldThreshold ?? DRAW_HOLD_THRESHOLD_DEFAULT;
  const repeating = scores.filter((entry) => entry.isRepeat);
  if (repeating.length === 0) {
    return scores;
  }
  const nonRepeating = scores.filter((entry) => !entry.isRepeat);
  if (nonRepeating.length === 0) {
    return scores;
  }
  const bestNonRepeat = Math.max(...nonRepeating.map((entry) => entry.baseScore));
  const bestRepeat = Math.max(...repeating.map((entry) => entry.baseScore));
  if (
    bestNonRepeat <= REPETITION_AVOID_LOSS_THRESHOLD &&
    bestRepeat - bestNonRepeat >= REPETITION_ESCAPE_MARGIN
  ) {
    return scores;
  }
  const basePenalty = options.repetitionPenalty ?? DEFAULT_REPETITION_PENALTY;
  const maxThinking = Boolean(options.maxThinking);

  return scores.map((entry) => {
    if (!entry.isRepeat) {
      return entry;
    }
    if (entry.baseScore < drawHoldThreshold) {
      return entry;
    }
    const advantageMultiplier = getRepetitionPenaltyMultiplier(entry.baseScore);
    if (advantageMultiplier <= 0) {
      return entry;
    }
    const repeatMultiplier =
      entry.repeatCount >= 2
        ? REPETITION_THREEFOLD_MULTIPLIER
        : entry.repeatCount === 1
          ? REPETITION_TWOFOLD_MULTIPLIER
          : REPETITION_NEAR_MULTIPLIER;
    let penalty = basePenalty * scale * advantageMultiplier * repeatMultiplier;
    if (maxThinking && entry.repeatCount >= 2) {
      penalty *= REPETITION_LOOP_MULTIPLIER;
    }
    return { ...entry, score: entry.score - penalty };
  });
}

function applyRootContempt(
  scores: RootScore[],
  options: SearchOptions,
  playForWin: boolean
): RootScore[] {
  if (!playForWin || !options.recentPositions?.length) {
    return scores;
  }
  const contempt = options.contemptCp ?? 0;
  if (contempt <= 0) {
    return scores;
  }
  const drawHoldThreshold = options.drawHoldThreshold ?? DRAW_HOLD_THRESHOLD_DEFAULT;
  return scores.map((entry) => {
    if (!entry.isRepeat || entry.baseScore < drawHoldThreshold) {
      return entry;
    }
    return { ...entry, score: entry.score - contempt };
  });
}

function getRepetitionTieBreakCandidates(
  scores: RootScore[],
  options: SearchOptions,
  playForWin: boolean
): RootScore[] | null {
  if (!playForWin || !options.recentPositions?.length) {
    return null;
  }
  const scale = options.repetitionPenaltyScale ?? 0;
  const hardNudgeScale = options.hardRepetitionNudgeScale ?? 0;
  if (scale <= 0 && hardNudgeScale <= 0) {
    return null;
  }
  let bestEntry = scores[0];
  for (const entry of scores) {
    if (entry.score > bestEntry.score) {
      bestEntry = entry;
    }
  }
  const drawHoldThreshold = options.drawHoldThreshold ?? DRAW_HOLD_THRESHOLD_DEFAULT;
  if (!bestEntry.isRepeat || bestEntry.baseScore < drawHoldThreshold) {
    return null;
  }
  let tieBreakWindow = REPETITION_TIEBREAK_WINDOW * scale;
  if (
    !options.maxThinking &&
    hardNudgeScale > 0 &&
    bestEntry.baseScore >= REPETITION_HARD_NUDGE_ADVANTAGE &&
    bestEntry.repeatCount > 0
  ) {
    const nudgeMultiplier =
      bestEntry.repeatCount >= 2 ? REPETITION_HARD_NUDGE_THREEFOLD_MULTIPLIER : 1;
    tieBreakWindow += REPETITION_HARD_NUDGE_WINDOW * hardNudgeScale * nudgeMultiplier;
  }
  if (tieBreakWindow <= 0) {
    return null;
  }
  const candidates = scores.filter(
    (entry) =>
      !entry.isRepeat &&
      entry.baseScore >= bestEntry.baseScore - tieBreakWindow &&
      entry.baseScore >= drawHoldThreshold
  );
  return candidates.length > 0 ? candidates : null;
}

// Test-only: expose repetition policy logic with synthetic scores.
export function applyRepetitionPolicyForTest(
  scores: {
    move: Move;
    baseScore: number;
    score: number;
    repeatCount: number;
    isRepeat: boolean;
  }[],
  options: {
    repetitionPenalty?: number;
    repetitionPenaltyScale?: number;
    hardRepetitionNudgeScale?: number;
    maxThinking?: boolean;
    drawHoldThreshold?: number;
    recentPositions?: string[];
  },
  playForWin: boolean
): {
  move: Move;
  baseScore: number;
  score: number;
  repeatCount: number;
  isRepeat: boolean;
}[] {
  return applyRepetitionPolicy(scores as RootScore[], options as SearchOptions, playForWin);
}

// Test-only: expose root contempt adjustments with synthetic scores.
export function applyRootContemptForTest(
  scores: {
    move: Move;
    baseScore: number;
    score: number;
    repeatCount: number;
    isRepeat: boolean;
  }[],
  options: {
    contemptCp?: number;
    drawHoldThreshold?: number;
    recentPositions?: string[];
  },
  playForWin: boolean
): {
  move: Move;
  baseScore: number;
  score: number;
  repeatCount: number;
  isRepeat: boolean;
}[] {
  return applyRootContempt(scores as RootScore[], options as SearchOptions, playForWin);
}

// Test-only: expose repetition tie-break candidates with synthetic scores.
export function getRepetitionTieBreakCandidatesForTest(
  scores: {
    move: Move;
    baseScore: number;
    score: number;
    repeatCount: number;
    isRepeat: boolean;
  }[],
  options: {
    repetitionPenaltyScale?: number;
    hardRepetitionNudgeScale?: number;
    maxThinking?: boolean;
    recentPositions?: string[];
  },
  playForWin: boolean
): {
  move: Move;
  baseScore: number;
  score: number;
  repeatCount: number;
  isRepeat: boolean;
}[] {
  return (
    getRepetitionTieBreakCandidates(
      scores as RootScore[],
      options as SearchOptions,
      playForWin
    ) ?? []
  );
}

function enforceRootRepetitionAvoidance(
  windowed: RootScore[],
  adjustedScores: RootScore[],
  options: SearchOptions,
  playForWin: boolean
): RootScore[] {
  if (!playForWin || windowed.length === 0) {
    return windowed;
  }
  const avoidWindow = options.repeatBanWindowCp ?? options.repetitionAvoidWindow ?? 0;
  if (avoidWindow <= 0) {
    return windowed;
  }
  let bestEntry = adjustedScores[0];
  for (const entry of adjustedScores) {
    if (entry.score > bestEntry.score) {
      bestEntry = entry;
    }
  }
  const drawHoldThreshold = options.drawHoldThreshold ?? DRAW_HOLD_THRESHOLD_DEFAULT;
  if (!bestEntry.isRepeat || bestEntry.baseScore < drawHoldThreshold) {
    return windowed;
  }
  const candidates = adjustedScores
    .filter(
      (entry) =>
        !entry.isRepeat &&
        entry.baseScore >= bestEntry.baseScore - avoidWindow &&
        entry.baseScore > REPETITION_CLEAR_DISADVANTAGE
    )
    .sort((a, b) => b.baseScore - a.baseScore || b.score - a.score);
  if (candidates.length === 0) {
    return windowed;
  }
  const bestNonRepeat = candidates[0];
  return adjustedScores.filter((entry) => entry.move === bestNonRepeat.move);
}

function getRepeatKind(entry: RootScore): 'none' | 'near-repetition' | 'threefold' {
  if (!entry.isRepeat) {
    return 'none';
  }
  return entry.repeatCount >= 2 ? 'threefold' : 'near-repetition';
}

function getBestRootScore(scores: RootScore[]): RootScore {
  let best = scores[0];
  for (const entry of scores) {
    if (entry.score > best.score || (entry.score === best.score && entry.baseScore > best.baseScore)) {
      best = entry;
    }
  }
  return best;
}

function buildRootDiagnostics(
  scores: RootScore[],
  chosen: RootScore,
  options: SearchOptions,
  playForWin: boolean
): RootDiagnostics {
  const sorted = [...scores].sort(
    (a, b) => b.score - a.score || b.baseScore - a.baseScore
  );
  const topMoves = sorted.slice(0, ROOT_DIAGNOSTICS_TOP_N).map((entry) => ({
    move: entry.move,
    score: entry.score,
    baseScore: entry.baseScore,
    isRepeat: entry.isRepeat,
    repeatCount: entry.repeatCount
  }));
  const bestEntry = getBestRootScore(scores);
  const drawHoldThreshold = options.drawHoldThreshold ?? DRAW_HOLD_THRESHOLD_DEFAULT;
  let reason: RootMoveReason = 'non-repeat-best';
  if (playForWin) {
    if (chosen.isRepeat) {
      reason =
        chosen.baseScore < drawHoldThreshold
          ? 'losing-allow-repeat'
          : 'repeat-best-no-close-alt';
    } else if (bestEntry.isRepeat) {
      reason = 'avoid-repeat-within-window';
    } else {
      reason = 'non-repeat-best';
    }
  }
  return {
    rootTopMoves: topMoves,
    chosenMoveReason: reason,
    bestRepeatKind: getRepeatKind(bestEntry),
    bestIsRepeat: bestEntry.isRepeat
  };
}

function orderRootMovesForRepeatAvoidance(
  state: GameState,
  color: Color,
  moves: Move[],
  options: SearchOptions,
  playForWin: boolean
): Move[] {
  if (!playForWin || !options.recentPositions?.length) {
    return moves;
  }
  const drawHoldThreshold = options.drawHoldThreshold ?? DRAW_HOLD_THRESHOLD_DEFAULT;
  const baseEval = evaluateState(state, color, { maxThinking: Boolean(options.maxThinking) });
  if (baseEval < drawHoldThreshold) {
    return moves;
  }
  const recentSet = new Set(options.recentPositions);
  const annotated = moves.map((move, index) => {
    const quietCandidate = !move.promotion && !isCaptureMove(state, move);
    if (!quietCandidate) {
      return { move, index, deprioritize: false };
    }
    const next = cloneState(state);
    next.activeColor = color;
    applyMove(next, move);
    const givesCheck = isInCheck(next, opponentColor(color));
    if (givesCheck) {
      return { move, index, deprioritize: false };
    }
    const repeatKey = getPositionKey(next);
    return { move, index, deprioritize: recentSet.has(repeatKey) };
  });
  if (!annotated.some((entry) => entry.deprioritize)) {
    return moves;
  }
  annotated.sort((a, b) => {
    if (a.deprioritize !== b.deprioritize) {
      return a.deprioritize ? 1 : -1;
    }
    return a.index - b.index;
  });
  return annotated.map((entry) => entry.move);
}

function getProgressBias(
  state: GameState,
  move: Move,
  color: Color,
  baseScore: number,
  options: SearchOptions,
  playForWin: boolean,
  givesCheck: boolean,
  repeatCount: number
): number {
  if (!playForWin) {
    return 0;
  }
  const drawHoldThreshold = options.drawHoldThreshold ?? DRAW_HOLD_THRESHOLD_DEFAULT;
  if (baseScore < drawHoldThreshold) {
    return 0;
  }
  if (isCaptureMove(state, move) || move.promotion || givesCheck) {
    return 0;
  }
  const movingPiece = getPieceAt(state, move.from);
  if (!movingPiece) {
    return 0;
  }

  let bias = 0;

  if (move.isCastle) {
    bias += PROGRESS_BONUS_CASTLE;
  }

  if ((movingPiece.type === 'knight' || movingPiece.type === 'bishop') && !movingPiece.hasMoved) {
    const startRank = color === 'w' ? 0 : 7;
    if (state.fullmoveNumber <= 12 && move.from.rank === startRank && move.to.rank !== startRank) {
      bias += PROGRESS_BONUS_MINOR;
    }
  }

  if (!move.isCastle && movingPiece.type === 'king') {
    const fromCenter = move.from.file >= 2 && move.from.file <= 4;
    const toFlank = move.to.file <= 1 || move.to.file >= 6;
    if (fromCenter && toFlank) {
      bias += PROGRESS_BONUS_KING_SAFETY;
    }
  }

  if (movingPiece.type === 'pawn') {
    const forward = color === 'w' ? 1 : -1;
    if ((move.to.rank - move.from.rank) * forward > 0) {
      bias += PROGRESS_BONUS_PAWN;
      if ((color === 'w' && move.to.rank >= 4) || (color === 'b' && move.to.rank <= 3)) {
        bias += PROGRESS_BONUS_PAWN_ADVANCED;
      }
    }
  }

  if (movingPiece.type === 'rook' && repeatCount > 0) {
    bias -= ROOK_SHUFFLE_PENALTY;
  }

  return bias;
}

function applyTwoPlyLoopPenalty(
  state: GameState,
  color: Color,
  scores: RootScore[],
  options: SearchOptions,
  playForWin: boolean,
  positionCounts?: Map<string, number>
): RootScore[] {
  const penaltyBase = options.twoPlyRepeatPenalty ?? 0;
  if (!playForWin || penaltyBase <= 0) {
    return scores;
  }
  const drawHoldThreshold = options.drawHoldThreshold ?? DRAW_HOLD_THRESHOLD_DEFAULT;
  const recentSet = new Set(options.recentPositions ?? []);
  const topN = options.twoPlyRepeatTopN ?? TWO_PLY_REPEAT_TOP_N_DEFAULT;
  const sorted = [...scores].sort((a, b) => b.score - a.score).slice(0, topN);

  const penalizedMoves = new Map<Move, number>();
  for (const entry of sorted) {
    if (entry.baseScore < drawHoldThreshold) {
      continue;
    }
    const penalty = computeTwoPlyPenalty(
      state,
      color,
      entry,
      recentSet,
      positionCounts,
      penaltyBase,
      Boolean(options.maxThinking)
    );
    if (penalty > 0) {
      penalizedMoves.set(entry.move, penalty);
    }
  }

  if (penalizedMoves.size === 0) {
    return scores;
  }

  return scores.map((entry) => {
    const penalty = penalizedMoves.get(entry.move) ?? 0;
    if (penalty === 0) {
      return entry;
    }
    return { ...entry, score: entry.score - penalty };
  });
}

function computeTwoPlyPenalty(
  state: GameState,
  color: Color,
  entry: RootScore,
  recentSet: Set<string>,
  positionCounts: Map<string, number> | undefined,
  penaltyBase: number,
  maxThinking: boolean
): number {
  const next = cloneState(state);
  next.activeColor = color;
  applyMove(next, entry.move);
  const opponent = opponentColor(color);
  const replies = getAllLegalMoves(next, opponent);
  if (replies.length === 0) {
    return 0;
  }
  let worstScore = Infinity;
  let repeatKey: string | null = null;
  for (const reply of replies) {
    const follow = cloneState(next);
    follow.activeColor = opponent;
    applyMove(follow, reply);
    const key = getPositionKey(follow);
    const score = evaluateState(follow, color, { maxThinking });
    if (score < worstScore) {
      worstScore = score;
      repeatKey = key;
    }
  }
  if (!repeatKey) {
    return 0;
  }
  const repeatCount = positionCounts?.get(repeatKey) ?? 0;
  const isRepeat = recentSet.has(repeatKey) || repeatCount > 0;
  if (!isRepeat) {
    return 0;
  }
  const multiplier = (entry.repeatCount >= 2 ? 1.5 : 1) * (maxThinking ? 1.2 : 1);
  return penaltyBase * multiplier;
}

function storeRootTt(options: SearchOptions, state: GameState, move: Move, score: number): void {
  if (!options.tt) {
    return;
  }
  const key = getPositionKey(state);
  options.tt.set(key, {
    depth: options.depth,
    score,
    flag: 'exact',
    bestMove: move
  });
}

export type OrderingState = {
  killerMoves: { primary?: Move; secondary?: Move }[];
  history: number[];
  counterMoves: (Move | undefined)[];
};

export function createOrderingState(maxDepth: number): OrderingState {
  const maxPlies = Math.max(8, maxDepth + 6);
  return {
    killerMoves: Array.from({ length: maxPlies }, () => ({})),
    history: new Array(64 * 64).fill(0),
    counterMoves: new Array(64 * 64).fill(undefined)
  };
}

type TimedSearchOptions = Omit<SearchOptions, 'depth'> & {
  maxDepth: number;
  maxTimeMs: number;
  now?: () => number;
  onDepth?: (depth: number) => void;
  onProgress?: (update: { depth: number; move: Move | null; score: number | null }) => void;
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
  rootDiagnostics?: RootDiagnostics;
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

  const ordering =
    options.ordering ?? (options.maxThinking ? createOrderingState(options.depth + 4) : undefined);
  const usePvs = options.usePvs ?? false;
  const playForWin = Boolean(options.playForWin && options.recentPositions?.length);
  const preferred = options.tt ? options.tt.get(getPositionKey(state))?.bestMove : undefined;
  const orderedBase = orderMoves(state, legalMoves, color, options.rng, {
    preferred,
    maxThinking: options.maxThinking,
    ordering,
    ply: 0,
    prevMove: state.lastMove
  });
  const ordered = orderRootMovesForRepeatAvoidance(state, color, orderedBase, options, playForWin);
  let bestSoFar: Move | null = ordered[0] ?? legalMoves[0] ?? null;
  const positionCounts = playForWin
    ? buildPositionCounts(options.recentPositions ?? [])
    : undefined;
  const topMoveWindow = options.topMoveWindow ?? DEFAULT_TOP_MOVE_WINDOW;
  const fairnessWindow = options.fairnessWindow ?? DEFAULT_FAIRNESS_WINDOW;
  const rootScores: RootScore[] = [];

  for (const move of ordered) {
    if (shouldStop()) {
      return bestSoFar ?? move;
    }
    const next = cloneState(state);
    next.activeColor = color;
    applyMove(next, move);

    const baseScore = alphaBeta(
      next,
      options.depth - 1,
      -Infinity,
      Infinity,
      opponentColor(color),
      color,
      options.rng,
      options.maxThinking ?? false,
      usePvs,
      1,
      options.tt,
      ordering,
      shouldStopChecked,
      options.microQuiescenceDepth
    );
    const givesCheck = isInCheck(next, opponentColor(color));
    const repeatKey = playForWin ? getPositionKey(next) : null;
    const repeatCount =
      repeatKey && positionCounts ? positionCounts.get(repeatKey) ?? 0 : 0;
    const progressBias = getProgressBias(
      state,
      move,
      color,
      baseScore,
      options,
      playForWin,
      givesCheck,
      repeatCount
    );
    rootScores.push({
      move,
      baseScore,
      score: baseScore + progressBias,
      repeatCount,
      isRepeat: repeatCount > 0
    });
  }

  if (rootScores.length === 1) {
    storeRootTt(options, state, rootScores[0].move, rootScores[0].baseScore);
    return rootScores[0].move;
  }

  const adjustedScores = applyRepetitionPolicy(rootScores, options, playForWin);
  const twoPlyAdjusted = applyTwoPlyLoopPenalty(
    state,
    color,
    adjustedScores,
    options,
    playForWin,
    positionCounts
  );
  const contemptAdjusted = applyRootContempt(twoPlyAdjusted, options, playForWin);
  const scoredMoves = contemptAdjusted.map((entry) => ({
    move: entry.move,
    score: entry.score,
    baseScore: entry.baseScore
  }));

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
      const chosen = baseLeaders[index];
      storeRootTt(options, state, chosen.move, chosen.baseScore);
      return chosen.move;
    }
  }

  const tieBreakCandidates = getRepetitionTieBreakCandidates(
    contemptAdjusted,
    options,
    playForWin
  );
  if (tieBreakCandidates) {
    const tieBreakMoves = new Set(tieBreakCandidates.map((entry) => entry.move));
    const filtered = windowed.filter((entry) => tieBreakMoves.has(entry.move));
    if (filtered.length > 0) {
      windowed = filtered;
    }
  }

  windowed = enforceRootRepetitionAvoidance(windowed, contemptAdjusted, options, playForWin);

  const index = Math.floor(options.rng() * windowed.length);
  const chosen = windowed[index];
  storeRootTt(options, state, chosen.move, chosen.baseScore);
  return chosen.move;
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
  const tt = options.tt ?? (options.maxThinking ? new Map<string, TTEntry>() : undefined);
  const ordering =
    options.ordering ?? (options.maxThinking ? createOrderingState(options.maxDepth + 4) : undefined);
  const usePvs = options.usePvs ?? false;
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
              repetitionPenaltyScale: options.repetitionPenaltyScale,
              hardRepetitionNudgeScale: options.hardRepetitionNudgeScale,
              repetitionAvoidWindow: options.repetitionAvoidWindow,
              repeatBanWindowCp: options.repeatBanWindowCp ?? options.repetitionAvoidWindow,
              drawHoldThreshold: options.drawHoldThreshold,
              twoPlyRepeatPenalty: options.twoPlyRepeatPenalty,
              twoPlyRepeatTopN: options.twoPlyRepeatTopN,
              contemptCp: options.contemptCp,
              microQuiescenceDepth: options.microQuiescenceDepth,
              topMoveWindow: options.topMoveWindow,
              fairnessWindow: options.fairnessWindow,
              maxThinking: options.maxThinking,
              usePvs,
              rootDiagnostics: options.rootDiagnostics,
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
          repetitionPenaltyScale: options.repetitionPenaltyScale,
          hardRepetitionNudgeScale: options.hardRepetitionNudgeScale,
          repetitionAvoidWindow: options.repetitionAvoidWindow,
          repeatBanWindowCp: options.repeatBanWindowCp ?? options.repetitionAvoidWindow,
          drawHoldThreshold: options.drawHoldThreshold,
          twoPlyRepeatPenalty: options.twoPlyRepeatPenalty,
          twoPlyRepeatTopN: options.twoPlyRepeatTopN,
          contemptCp: options.contemptCp,
          microQuiescenceDepth: options.microQuiescenceDepth,
          topMoveWindow: options.topMoveWindow,
          fairnessWindow: options.fairnessWindow,
          maxThinking: options.maxThinking,
          usePvs,
          rootDiagnostics: options.rootDiagnostics,
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
      options.onProgress?.({
        depth,
        move: scored.move,
        score: scored.score
      });
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
    repetitionPenaltyScale: options.repetitionPenaltyScale,
    hardRepetitionNudgeScale: options.hardRepetitionNudgeScale,
    repetitionAvoidWindow: options.repetitionAvoidWindow,
    repeatBanWindowCp: options.repeatBanWindowCp ?? options.repetitionAvoidWindow,
    drawHoldThreshold: options.drawHoldThreshold,
    twoPlyRepeatPenalty: options.twoPlyRepeatPenalty,
    twoPlyRepeatTopN: options.twoPlyRepeatTopN,
    contemptCp: options.contemptCp,
    microQuiescenceDepth: options.microQuiescenceDepth,
    topMoveWindow: options.topMoveWindow,
    fairnessWindow: options.fairnessWindow,
    maxThinking: options.maxThinking,
    usePvs,
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
  const tt = options.tt ?? (options.maxThinking ? new Map<string, TTEntry>() : undefined);
  const ordering =
    options.ordering ?? (options.maxThinking ? createOrderingState(options.maxDepth + 4) : undefined);
  const usePvs = options.usePvs ?? false;
  const aspirationWindow = options.maxThinking
    ? options.aspirationWindow ?? DEFAULT_ASPIRATION_WINDOW
    : 0;
  const aspirationMaxRetries =
    options.aspirationMaxRetries ?? DEFAULT_ASPIRATION_MAX_RETRIES;
  let depthCompleted = 0;
  let bestMove: Move | null = null;
  let bestScore: number | null = null;
  let scoredMoves: MateProbeScoredMove[] = [];
  let rootDiagnostics: RootDiagnostics | undefined;
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
              repetitionPenaltyScale: options.repetitionPenaltyScale,
              hardRepetitionNudgeScale: options.hardRepetitionNudgeScale,
              repetitionAvoidWindow: options.repetitionAvoidWindow,
              repeatBanWindowCp: options.repeatBanWindowCp ?? options.repetitionAvoidWindow,
              drawHoldThreshold: options.drawHoldThreshold,
              twoPlyRepeatPenalty: options.twoPlyRepeatPenalty,
              twoPlyRepeatTopN: options.twoPlyRepeatTopN,
              contemptCp: options.contemptCp,
              microQuiescenceDepth: options.microQuiescenceDepth,
              topMoveWindow: options.topMoveWindow,
              fairnessWindow: options.fairnessWindow,
              maxThinking: options.maxThinking,
              usePvs,
              rootDiagnostics: options.rootDiagnostics,
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
          repetitionPenaltyScale: options.repetitionPenaltyScale,
          hardRepetitionNudgeScale: options.hardRepetitionNudgeScale,
          repetitionAvoidWindow: options.repetitionAvoidWindow,
          repeatBanWindowCp: options.repeatBanWindowCp ?? options.repetitionAvoidWindow,
          drawHoldThreshold: options.drawHoldThreshold,
          twoPlyRepeatPenalty: options.twoPlyRepeatPenalty,
          twoPlyRepeatTopN: options.twoPlyRepeatTopN,
          contemptCp: options.contemptCp,
          microQuiescenceDepth: options.microQuiescenceDepth,
          topMoveWindow: options.topMoveWindow,
          fairnessWindow: options.fairnessWindow,
          maxThinking: options.maxThinking,
          usePvs,
          rootDiagnostics: options.rootDiagnostics,
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
      if (scored.rootDiagnostics) {
        rootDiagnostics = scored.rootDiagnostics;
      }
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
      repetitionPenaltyScale: options.repetitionPenaltyScale,
      hardRepetitionNudgeScale: options.hardRepetitionNudgeScale,
      repetitionAvoidWindow: options.repetitionAvoidWindow,
      repeatBanWindowCp: options.repeatBanWindowCp ?? options.repetitionAvoidWindow,
      drawHoldThreshold: options.drawHoldThreshold,
      twoPlyRepeatPenalty: options.twoPlyRepeatPenalty,
      twoPlyRepeatTopN: options.twoPlyRepeatTopN,
      contemptCp: options.contemptCp,
      microQuiescenceDepth: options.microQuiescenceDepth,
      topMoveWindow: options.topMoveWindow,
      fairnessWindow: options.fairnessWindow,
      maxThinking: options.maxThinking,
      usePvs,
      rootDiagnostics: options.rootDiagnostics,
      tt,
      ordering
    },
    undefined,
    shouldStop
  );
  bestMove = scored.move;
  bestScore = scored.score;
  scoredMoves = scored.scoredMoves;
  if (scored.rootDiagnostics) {
    rootDiagnostics = scored.rootDiagnostics;
  }
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
    rootDiagnostics,
    ttEntries: getTtSize(tt),
    aspirationRetries
  };
}

function scoreRootMoves(
  state: GameState,
  color: Color,
  options: SearchOptions,
  window?: { alpha: number; beta: number },
  shouldStop?: () => boolean
): {
  move: Move | null;
  score: number | null;
  scoredMoves: MateProbeScoredMove[];
  rootDiagnostics?: RootDiagnostics;
} {
  const playForWin = Boolean(options.playForWin && options.recentPositions?.length);
  const orderedBase = orderMoves(state, options.legalMoves ?? [], color, options.rng, {
    preferred: options.tt ? options.tt.get(getPositionKey(state))?.bestMove : undefined,
    maxThinking: options.maxThinking,
    ordering: options.ordering,
    ply: 0,
    prevMove: state.lastMove
  });
  const ordered = orderRootMovesForRepeatAvoidance(state, color, orderedBase, options, playForWin);
  const alpha = window?.alpha ?? -Infinity;
  const beta = window?.beta ?? Infinity;
  const positionCounts = playForWin
    ? buildPositionCounts(options.recentPositions ?? [])
    : undefined;
  const topMoveWindow = options.topMoveWindow ?? DEFAULT_TOP_MOVE_WINDOW;
  const fairnessWindow = options.fairnessWindow ?? DEFAULT_FAIRNESS_WINDOW;

  const rootScores: RootScore[] = [];
  for (const move of ordered) {
    if (shouldStop && shouldStop()) {
      break;
    }
    const next = cloneState(state);
    next.activeColor = color;
    applyMove(next, move);

    const baseScore = alphaBeta(
      next,
      options.depth - 1,
      alpha,
      beta,
      opponentColor(color),
      color,
      options.rng,
      options.maxThinking ?? false,
      options.usePvs ?? false,
      1,
      options.tt,
      options.ordering,
      shouldStop,
      options.microQuiescenceDepth
    );
    const givesCheck = isInCheck(next, opponentColor(color));
    const repeatKey = playForWin ? getPositionKey(next) : null;
    const repeatCount =
      repeatKey && positionCounts ? positionCounts.get(repeatKey) ?? 0 : 0;
    const progressBias = getProgressBias(
      state,
      move,
      color,
      baseScore,
      options,
      playForWin,
      givesCheck,
      repeatCount
    );
    rootScores.push({
      move,
      baseScore,
      score: baseScore + progressBias,
      repeatCount,
      isRepeat: repeatCount > 0
    });
  }

  if (rootScores.length === 0) {
    return { move: ordered[0] ?? null, score: null, scoredMoves: [] };
  }

  const adjustedScores = applyRepetitionPolicy(rootScores, options, playForWin);
  const twoPlyAdjusted = applyTwoPlyLoopPenalty(
    state,
    color,
    adjustedScores,
    options,
    playForWin,
    positionCounts
  );
  const contemptAdjusted = applyRootContempt(twoPlyAdjusted, options, playForWin);
  const scoredMoves = contemptAdjusted.map((entry) => {
    const mateInfo = getMateInfo(entry.score);
    return {
      move: entry.move,
      score: entry.score,
      baseScore: entry.baseScore,
      mateInPly: mateInfo?.mateInPly ?? null,
      mateInMoves: mateInfo?.mateInMoves ?? null
    };
  });

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
      const chosen = baseLeaders[index];
      const chosenEntry =
        contemptAdjusted.find((entry) => entry.move === chosen.move) ?? contemptAdjusted[0];
      const rootDiagnostics =
        options.rootDiagnostics && chosenEntry
          ? buildRootDiagnostics(contemptAdjusted, chosenEntry, options, playForWin)
          : undefined;
      storeRootTt(options, state, chosen.move, chosen.baseScore);
      return { move: chosen.move, score: chosen.score, scoredMoves, rootDiagnostics };
    }
  }

  const tieBreakCandidates = getRepetitionTieBreakCandidates(
    contemptAdjusted,
    options,
    playForWin
  );
  if (tieBreakCandidates) {
    const tieBreakMoves = new Set(tieBreakCandidates.map((entry) => entry.move));
    const filtered = windowed.filter((entry) => tieBreakMoves.has(entry.move));
    if (filtered.length > 0) {
      windowed = filtered;
    }
  }

  windowed = enforceRootRepetitionAvoidance(windowed, contemptAdjusted, options, playForWin);

  const index = Math.floor(options.rng() * windowed.length);
  const chosen = windowed[index];
  const chosenEntry = contemptAdjusted.find((entry) => entry.move === chosen.move) ?? contemptAdjusted[0];
  const rootDiagnostics =
    options.rootDiagnostics && chosenEntry
      ? buildRootDiagnostics(contemptAdjusted, chosenEntry, options, playForWin)
      : undefined;
  storeRootTt(options, state, chosen.move, chosen.baseScore);
  return { move: chosen.move, score: chosen.score, scoredMoves, rootDiagnostics };
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
  usePvs: boolean,
  ply: number,
  tt?: TtStore,
  ordering?: OrderingState,
  stopChecker?: () => boolean,
  microQuiescenceDepth?: number
): number {
  if (stopChecker && stopChecker()) {
    return evaluateState(state, maximizingColor, { maxThinking });
  }
  const legalMoves = getAllLegalMoves(state, currentColor);
  const alphaOrig = alpha;
  const betaOrig = beta;
  let key: string | null = null;
  let ttBestMove: Move | undefined;

  if (tt) {
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
      return mateScore(currentColor, maximizingColor, ply);
    }
    return 0;
  }

  if (depth <= 0) {
    if (!maxThinking) {
      const microDepth = Math.min(
        microQuiescenceDepth ?? 0,
        HARD_MICRO_QUIESCENCE_MAX_DEPTH
      );
      if (microDepth > 0) {
        return microQuiescence(
          state,
          alpha,
          beta,
          currentColor,
          maximizingColor,
          rng,
          ply,
          microDepth,
          stopChecker
        );
      }
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
  const pvsEnabled = maxThinking && usePvs;

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
      usePvs,
      ply + 1,
      tt,
      ordering,
      stopChecker,
      microQuiescenceDepth
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
    ply,
    prevMove: state.lastMove
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
      const extension = getForcingExtension(state, next, move, currentColor, depth, ply);
      const reducedDepth = Math.max(0, depth - 1 - reduction + extension);
      const canPvs = pvsEnabled && index > 0 && Number.isFinite(alpha) && Number.isFinite(beta);
      let nextScore: number;
      if (canPvs) {
        nextScore = alphaBeta(
          next,
          reducedDepth,
          alpha,
          alpha + 1,
          opponentColor(currentColor),
          maximizingColor,
          rng,
          maxThinking,
          usePvs,
          ply + 1,
          tt,
          ordering,
          stopChecker,
          microQuiescenceDepth
        );
        if (nextScore > alpha && nextScore < beta) {
          nextScore = alphaBeta(
            next,
            reducedDepth,
            alpha,
            beta,
            opponentColor(currentColor),
            maximizingColor,
            rng,
            maxThinking,
            usePvs,
            ply + 1,
            tt,
            ordering,
            stopChecker,
            microQuiescenceDepth
          );
        }
      } else {
        nextScore = alphaBeta(
          next,
          reducedDepth,
          alpha,
          beta,
          opponentColor(currentColor),
          maximizingColor,
          rng,
          maxThinking,
          usePvs,
          ply + 1,
          tt,
          ordering,
          stopChecker,
          microQuiescenceDepth
        );
      }
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
          usePvs,
          ply + 1,
          tt,
          ordering,
          stopChecker,
          microQuiescenceDepth
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
        if (ordering && isQuietForOrdering(state, move, currentColor)) {
          if (maxThinking) {
            recordKiller(ordering, ply, move);
            recordCounterMove(ordering, state.lastMove, move);
          }
          recordHistory(ordering, move, depth);
        }
        break;
      }
    }
    if (tt && key) {
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
    const extension = getForcingExtension(state, next, move, currentColor, depth, ply);
    const reducedDepth = Math.max(0, depth - 1 - reduction + extension);
    const canPvs = pvsEnabled && index > 0 && Number.isFinite(alpha) && Number.isFinite(beta);
    let nextScore: number;
    if (canPvs) {
      nextScore = alphaBeta(
        next,
        reducedDepth,
        beta - 1,
        beta,
        opponentColor(currentColor),
        maximizingColor,
        rng,
        maxThinking,
        usePvs,
        ply + 1,
        tt,
        ordering,
        stopChecker,
        microQuiescenceDepth
      );
      if (nextScore < beta && nextScore > alpha) {
        nextScore = alphaBeta(
          next,
          reducedDepth,
          alpha,
          beta,
          opponentColor(currentColor),
          maximizingColor,
          rng,
          maxThinking,
          usePvs,
          ply + 1,
          tt,
          ordering,
          stopChecker,
          microQuiescenceDepth
        );
      }
    } else {
      nextScore = alphaBeta(
        next,
        reducedDepth,
        alpha,
        beta,
        opponentColor(currentColor),
        maximizingColor,
        rng,
        maxThinking,
        usePvs,
        ply + 1,
        tt,
        ordering,
        stopChecker,
        microQuiescenceDepth
      );
    }
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
        usePvs,
        ply + 1,
        tt,
        ordering,
        stopChecker,
        microQuiescenceDepth
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
      if (ordering && isQuietForOrdering(state, move, currentColor)) {
        if (maxThinking) {
          recordKiller(ordering, ply, move);
          recordCounterMove(ordering, state.lastMove, move);
        }
        recordHistory(ordering, move, depth);
      }
      break;
    }
  }
  if (tt && key) {
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
  options?: {
    preferred?: Move;
    maxThinking?: boolean;
    ordering?: OrderingState;
    ply?: number;
    prevMove?: Move | null;
  }
): Move[] {
  const preferred = options?.preferred;
  const maxThinking = options?.maxThinking ?? false;
  const ordering = options?.ordering;
  const ply = options?.ply ?? 0;
  const prevMove = options?.prevMove ?? null;
  const inCheck = isInCheck(state, color);
  const scored = moves.map((move, index) => ({
    move,
    score:
      buildOrderScore(state, move, color, maxThinking, {
        preferred,
        ordering,
        ply,
        prevMove
      }) +
      (inCheck ? scoreCheckEvasion(state, move, color) : 0),
    tie: maxThinking ? index : rng()
  }));

  scored.sort((a, b) => b.score - a.score || a.tie - b.tie);
  return scored.map((entry) => entry.move);
}

function scoreCheckEvasion(state: GameState, move: Move, color: Color): number {
  const next = cloneState(state);
  next.activeColor = color;
  applyMove(next, move);
  if (isInCheck(next, color)) {
    return -CHECK_EVASION_KING_INTO_ATTACK_PENALTY;
  }

  const movingPiece = getPieceAt(state, move.from);
  if (!movingPiece) {
    return 0;
  }

  const isCapture = isCaptureMove(state, move);
  if (isCapture) {
    return CHECK_EVASION_CAPTURE_BONUS;
  }

  if (movingPiece.type !== 'king') {
    return CHECK_EVASION_BLOCK_BONUS;
  }

  let score = -CHECK_EVASION_KING_MOVE_PENALTY;
  if (isSquareAttackedByOpponent(next, move.to, color)) {
    score -= CHECK_EVASION_KING_INTO_ATTACK_PENALTY;
  }
  return score;
}

function isSquareAttackedByOpponent(
  state: GameState,
  square: { file: number; rank: number },
  color: Color
): boolean {
  const opponentMoves = getAllLegalMoves(state, opponentColor(color));
  return opponentMoves.some(
    (move) => move.to.file === square.file && move.to.rank === square.rank
  );
}

export function orderMovesForTest(
  state: GameState,
  moves: Move[],
  color: Color,
  rng: () => number,
  options?: {
    preferred?: Move;
    maxThinking?: boolean;
    ordering?: OrderingState;
    ply?: number;
    prevMove?: Move | null;
  }
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
  options: {
    preferred?: Move;
    ordering?: OrderingState;
    ply: number;
    prevMove?: Move | null;
  }
): number {
  let score = scoreMoveHeuristic(state, move, color, maxThinking);

  if (options.preferred && sameMove(move, options.preferred)) {
    score += 100000;
  }

  if (options.ordering) {
    const quiet = isQuietForOrdering(state, move, color);
    const historyCap = maxThinking ? MAX_HISTORY_BONUS_CAP : HARD_HISTORY_BONUS_CAP;
    const historyScore = quiet
      ? Math.min(getHistoryScore(options.ordering, move), historyCap)
      : 0;
    const killerScore = maxThinking ? getKillerScore(options.ordering, options.ply, move) : 0;
    const countermoveScore =
      maxThinking && options.prevMove ? getCounterMoveScore(options.ordering, options.prevMove, move) : 0;
    score += killerScore + historyScore + countermoveScore;
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

function getCounterMoveScore(
  ordering: OrderingState,
  previousMove: Move,
  move: Move
): number {
  const counter = ordering.counterMoves[getCounterMoveIndex(previousMove)];
  if (counter && sameMove(counter, move)) {
    return COUNTERMOVE_BONUS;
  }
  return 0;
}

function recordCounterMove(
  ordering: OrderingState,
  previousMove: Move | null | undefined,
  move: Move
): void {
  if (!previousMove) {
    return;
  }
  ordering.counterMoves[getCounterMoveIndex(previousMove)] = move;
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

function getCounterMoveIndex(move: Move): number {
  return getHistoryIndex(move);
}

function microQuiescence(
  state: GameState,
  alpha: number,
  beta: number,
  currentColor: Color,
  maximizingColor: Color,
  rng: () => number,
  ply: number,
  depthLeft: number,
  stopChecker?: () => boolean
): number {
  if (stopChecker && stopChecker()) {
    return evaluateState(state, maximizingColor, { maxThinking: false });
  }

  const legalMoves = getAllLegalMoves(state, currentColor);
  if (legalMoves.length === 0) {
    if (isInCheck(state, currentColor)) {
      return mateScore(currentColor, maximizingColor, ply);
    }
    return 0;
  }

  const standPat = evaluateState(state, maximizingColor, { maxThinking: false });
  if (depthLeft <= 0) {
    return standPat;
  }

  const ordered = orderMoves(state, legalMoves, currentColor, rng, {
    maxThinking: false,
    prevMove: state.lastMove
  });
  const maximizing = currentColor === maximizingColor;

  if (maximizing) {
    let value = standPat;
    let foundCheck = false;
    for (const move of ordered) {
      if (stopChecker && stopChecker()) {
        return value;
      }
      const next = cloneState(state);
      next.activeColor = currentColor;
      applyMove(next, move);
      if (!isInCheck(next, opponentColor(currentColor))) {
        continue;
      }
      foundCheck = true;
      value = Math.max(
        value,
        microQuiescence(
          next,
          alpha,
          beta,
          opponentColor(currentColor),
          maximizingColor,
          rng,
          ply + 1,
          depthLeft - 1,
          stopChecker
        )
      );
      alpha = Math.max(alpha, value);
      if (alpha >= beta) {
        break;
      }
    }
    return foundCheck ? value : standPat;
  }

  let value = standPat;
  let foundCheck = false;
  for (const move of ordered) {
    if (stopChecker && stopChecker()) {
      return value;
    }
    const next = cloneState(state);
    next.activeColor = currentColor;
    applyMove(next, move);
    if (!isInCheck(next, opponentColor(currentColor))) {
      continue;
    }
    foundCheck = true;
    value = Math.min(
      value,
      microQuiescence(
        next,
        alpha,
        beta,
        opponentColor(currentColor),
        maximizingColor,
        rng,
        ply + 1,
        depthLeft - 1,
        stopChecker
      )
    );
    beta = Math.min(beta, value);
    if (alpha >= beta) {
      break;
    }
  }
  return foundCheck ? value : standPat;
}

function isRecapture(state: GameState, move: Move): boolean {
  if (!state.lastMove) {
    return false;
  }
  if (!isCaptureMove(state, move)) {
    return false;
  }
  return (
    move.to.file === state.lastMove.to.file &&
    move.to.rank === state.lastMove.to.rank
  );
}

function getForcingExtension(
  state: GameState,
  next: GameState,
  move: Move,
  currentColor: Color,
  depth: number,
  ply: number
): number {
  if (depth <= 0) {
    return 0;
  }
  if (depth > FORCING_EXTENSION_MAX_DEPTH || ply >= FORCING_EXTENSION_MAX_PLY) {
    return 0;
  }
  if (move.promotion) {
    return 1;
  }
  if (depth >= 2 && isRecapture(state, move)) {
    return 1;
  }
  if (
    isInCheck(next, opponentColor(currentColor)) &&
    !isMovedPieceHanging(next, move, currentColor)
  ) {
    return 1;
  }
  return 0;
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
    maxThinking: true,
    prevMove: state.lastMove
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

// Test-only: expose mate-distance scoring preference.
export function mateScoreForTest(
  currentColor: Color,
  maximizingColor: Color,
  ply: number
): number {
  return mateScore(currentColor, maximizingColor, ply);
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

export function isRecaptureForTest(state: GameState, move: Move): boolean {
  return isRecapture(state, move);
}

// Test-only: expose avoidance selection with synthetic scores.
export function chooseWithRepetitionAvoidanceForTest(
  windowed: {
    move: Move;
    baseScore: number;
    score: number;
    repeatCount: number;
    isRepeat: boolean;
  }[],
  adjustedScores: {
    move: Move;
    baseScore: number;
    score: number;
    repeatCount: number;
    isRepeat: boolean;
  }[],
  options: {
    repeatBanWindowCp?: number;
    repetitionAvoidWindow?: number;
    drawHoldThreshold?: number;
  }
): Move | null {
  const result = enforceRootRepetitionAvoidance(
    windowed as RootScore[],
    adjustedScores as RootScore[],
    options as SearchOptions,
    true
  );
  return result[0]?.move ?? null;
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
