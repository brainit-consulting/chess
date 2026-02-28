import {
  Color,
  GameState,
  PieceType,
  findKingSquare,
  getAllLegalMoves,
  getPieceSquares,
  isInCheck
} from '../rules';
import {
  evaluateNnue,
  getNnueWeights,
  getOrCreateDefaultWeights
} from './nnue';

export const PIECE_VALUES: Record<PieceType, number> = {
  pawn: 100,
  knight: 320,
  bishop: 330,
  rook: 500,
  queen: 900,
  king: 20000
};

const MOBILITY_WEIGHT = 2;
const CHECK_PENALTY = 50;
const OPENING_FULLMOVE_LIMIT = 10;
const KING_HOME_BONUS = 20;
const KING_CASTLED_BONUS = 35;
const KING_MOVE_PENALTY = 8;
const PAWN_SHIELD_PENALTY = 12;
const EARLY_QUEEN_PENALTY = 20;
const CORE_EARLY_QUEEN_PENALTY_SCALE = 1;
const KING_UNCASTLED_PENALTY = 12;
const KING_CENTRAL_PENALTY = 10;
const KING_QUEEN_PRESENT_MULTIPLIER = 1.4;
const KING_PHASE_START = 10;
const KING_PHASE_END = 20;
const ROOK_OPEN_FILE_BONUS = 10;
const ROOK_SEMI_OPEN_FILE_BONUS = 6;
const QUEEN_OPEN_FILE_BONUS = 6;
const QUEEN_SEMI_OPEN_FILE_BONUS = 4;
const KING_OPEN_FILE_PENALTY = 12;
const MAX_KING_RING_PAWN_PENALTY = 5;
const ENABLE_KING_RING_ATTACK_PENALTY = true;
const KING_RING_ATTACK_PENALTY_CP = 6;
const KING_RING_ENDGAME_SCALE = 0.5;
const NNUE_MIX_DEFAULT = 0;
const NNUE_SCORE_CLAMP = 2000;

// Material-based game phase
const PHASE_QUEEN = 4;
const PHASE_ROOK = 2;
const PHASE_BISHOP = 1;
const PHASE_KNIGHT = 1;
const TOTAL_PHASE = 24;

// Tapered pawn structure (opening / endgame)
const DOUBLED_PAWN_PENALTY_OPENING = 12;
const DOUBLED_PAWN_PENALTY_ENDGAME = 20;
const ISOLATED_PAWN_PENALTY_OPENING = 15;
const ISOLATED_PAWN_PENALTY_ENDGAME = 25;
const PASSED_PAWN_BASE_BONUS_OPENING = 20;
const PASSED_PAWN_BASE_BONUS_ENDGAME = 35;
const PASSED_PAWN_RANK_BONUS_OPENING = 10;
const PASSED_PAWN_RANK_BONUS_ENDGAME = 15;

// Bishop pair
const BISHOP_PAIR_BONUS = 30;

// Tapered rook on 7th rank
const ROOK_ON_7TH_BONUS_OPENING = 20;
const ROOK_ON_7TH_BONUS_ENDGAME = 30;
const ROOK_ON_7TH_KING_TRAPPED_BONUS = 10;

// Tapered connected passed pawns
const CONNECTED_PASSED_PAWN_BONUS_OPENING = 15;
const CONNECTED_PASSED_PAWN_BONUS_ENDGAME = 25;
const CONNECTED_PASSED_PAWN_RANK_BONUS_OPENING = 5;
const CONNECTED_PASSED_PAWN_RANK_BONUS_ENDGAME = 8;

// King proximity to passed pawns (Max-only, endgame-tapered)
const PASSED_PAWN_ENEMY_KING_DIST_SCALE = 8;
const PASSED_PAWN_FRIENDLY_KING_CLOSE_SCALE = 6;

// Knight outpost bonus (Max-only)
const KNIGHT_OUTPOST_BONUS = 20;

// Lone king mating knowledge (Max-only)
const LONE_KING_EDGE_BONUS = 15;
const LONE_KING_CORNER_BONUS = 10;
const LONE_KING_CLOSE_KING_BONUS = 12;

const KNIGHT_PST_OPENING = [
  -50, -40, -30, -30, -30, -30, -40, -50,
  -40, -20, 0, 0, 0, 0, -20, -40,
  -30, 0, 10, 15, 15, 10, 0, -30,
  -30, 5, 15, 20, 20, 15, 5, -30,
  -30, 0, 15, 20, 20, 15, 0, -30,
  -30, 5, 10, 15, 15, 10, 5, -30,
  -40, -20, 0, 5, 5, 0, -20, -40,
  -50, -40, -30, -30, -30, -30, -40, -50
];

const KNIGHT_PST_ENDGAME = [
  -40, -30, -20, -20, -20, -20, -30, -40,
  -30, -10,   5,   5,   5,   5, -10, -30,
  -20,   5,  15,  20,  20,  15,   5, -20,
  -20,   5,  20,  25,  25,  20,   5, -20,
  -20,   5,  20,  25,  25,  20,   5, -20,
  -20,   5,  15,  20,  20,  15,   5, -20,
  -30, -10,   5,   5,   5,   5, -10, -30,
  -40, -30, -20, -20, -20, -20, -30, -40
];

const BISHOP_PST_OPENING = [
  -20, -10, -10, -10, -10, -10, -10, -20,
  -10, 0, 0, 0, 0, 0, 0, -10,
  -10, 0, 5, 10, 10, 5, 0, -10,
  -10, 5, 5, 10, 10, 5, 5, -10,
  -10, 0, 10, 10, 10, 10, 0, -10,
  -10, 10, 10, 10, 10, 10, 10, -10,
  -10, 5, 0, 0, 0, 0, 5, -10,
  -20, -10, -10, -10, -10, -10, -10, -20
];

const BISHOP_PST_ENDGAME = [
  -15, -10, -10, -10, -10, -10, -10, -15,
  -10,   0,   0,   5,   5,   0,   0, -10,
  -10,   0,  10,  10,  10,  10,   0, -10,
  -10,   5,  10,  15,  15,  10,   5, -10,
  -10,   5,  10,  15,  15,  10,   5, -10,
  -10,   0,  10,  10,  10,  10,   0, -10,
  -10,   0,   0,   5,   5,   0,   0, -10,
  -15, -10, -10, -10, -10, -10, -10, -15
];

const KING_PST_ENDGAME = [
  -20, -10,  -5,   0,   0,  -5, -10, -20,
  -10,   0,   5,  10,  10,   5,   0, -10,
   -5,   5,  15,  20,  20,  15,   5,  -5,
    0,  10,  20,  25,  25,  20,  10,   0,
    0,  10,  20,  25,  25,  20,  10,   0,
   -5,   5,  15,  20,  20,  15,   5,  -5,
  -10,   0,   5,  10,  10,   5,   0, -10,
  -20, -10,  -5,   0,   0,  -5, -10, -20
];

type EvalOptions = {
  maxThinking?: boolean;
  nnueMix?: number;
};

type EvalContext = {
  squares: Map<number, { file: number; rank: number }>;
  pawnFiles: Record<Color, number[]>;
  pawnRanks: Record<Color, number[][]>;
  rookQueenFiles: Record<Color, boolean[]>;
  queenCount: number;
  bishopCount: Record<Color, number>;
  rookSquares: Record<Color, { file: number; rank: number }[]>;
  passedPawns: Record<Color, { file: number; rank: number }[]>;
  phaseFactor: number;
  gamePhase: number;
};

export function evaluateState(
  state: GameState,
  perspective: Color,
  options: EvalOptions = {}
): number {
  const squares = getPieceSquares(state);
  const pawnFiles: Record<Color, number[]> = {
    w: new Array(8).fill(0),
    b: new Array(8).fill(0)
  };
  const pawnRanks: Record<Color, number[][]> = {
    w: [[], [], [], [], [], [], [], []],
    b: [[], [], [], [], [], [], [], []]
  };
  const rookQueenFiles: Record<Color, boolean[]> = {
    w: new Array(8).fill(false),
    b: new Array(8).fill(false)
  };
  let queenCount = 0;
  const bishopCount: Record<Color, number> = { w: 0, b: 0 };
  const rookSquares: Record<Color, { file: number; rank: number }[]> = { w: [], b: [] };
  let material = 0;
  for (const piece of state.pieces.values()) {
    const value = PIECE_VALUES[piece.type];
    material += piece.color === 'w' ? value : -value;
    if (piece.type === 'queen') {
      queenCount += 1;
    }
    if (piece.type === 'bishop') {
      bishopCount[piece.color] += 1;
    }
    const square = squares.get(piece.id);
    if (!square) {
      continue;
    }
    if (piece.type === 'pawn') {
      pawnFiles[piece.color][square.file] += 1;
      pawnRanks[piece.color][square.file].push(square.rank);
    }
    if (piece.type === 'rook' || piece.type === 'queen') {
      rookQueenFiles[piece.color][square.file] = true;
    }
    if (piece.type === 'rook') {
      rookSquares[piece.color].push(square);
    }
  }

  const whiteLegalMoves = getAllLegalMoves(state, 'w');
  const blackLegalMoves = getAllLegalMoves(state, 'b');
  const mobility = (whiteLegalMoves.length - blackLegalMoves.length) * MOBILITY_WEIGHT;

  let checkScore = 0;
  if (isInCheck(state, 'w')) {
    checkScore -= CHECK_PENALTY;
  }
  if (isInCheck(state, 'b')) {
    checkScore += CHECK_PENALTY;
  }

  const context: EvalContext = {
    squares,
    pawnFiles,
    pawnRanks,
    rookQueenFiles,
    queenCount,
    bishopCount,
    rookSquares,
    passedPawns: { w: [], b: [] },
    phaseFactor: getPhaseFactor(state.fullmoveNumber),
    gamePhase: calculateGamePhase(state)
  };
  const kingExposure =
    kingExposureScore(state, context, 'w') - kingExposureScore(state, context, 'b');
  const kingRingPenalty =
    -kingRingPenaltyScore(state, context, 'w') +
    kingRingPenaltyScore(state, context, 'b');
  const filePressure = filePressureScore(state, context);
  const coreEarlyQueen =
    options.maxThinking
      ? 0
      : (earlyQueenScore(state, squares, 'w') - earlyQueenScore(state, squares, 'b')) *
        CORE_EARLY_QUEEN_PENALTY_SCALE;
  const pawnStructure =
    pawnStructureScore(context, 'w') - pawnStructureScore(context, 'b');
  const rookSeventh =
    rookOn7thScore(state, context, 'w') - rookOn7thScore(state, context, 'b');
  const maxScore = options.maxThinking ? evaluateMaxThinking(state, context) : 0;
  const classicalScore =
    material +
    mobility +
    checkScore +
    kingExposure +
    kingRingPenalty +
    filePressure +
    coreEarlyQueen +
    pawnStructure +
    rookSeventh +
    maxScore;

  const nnueMix = options.maxThinking
    ? clamp01(options.nnueMix ?? NNUE_MIX_DEFAULT)
    : 0;
  if (nnueMix <= 0) {
    return perspective === 'w' ? classicalScore : -classicalScore;
  }

  const weights = getNnueWeights() ?? getOrCreateDefaultWeights();
  const rawNnueScore = evaluateNnue(state, weights);
  if (!Number.isFinite(rawNnueScore)) {
    return perspective === 'w' ? classicalScore : -classicalScore;
  }
  const nnueScore = clampScore(rawNnueScore);
  const blended = classicalScore * (1 - nnueMix) + nnueScore * nnueMix;
  return perspective === 'w' ? blended : -blended;
}

function clamp01(value: number): number {
  if (value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1;
  }
  return value;
}

function clampScore(value: number): number {
  if (value > NNUE_SCORE_CLAMP) {
    return NNUE_SCORE_CLAMP;
  }
  if (value < -NNUE_SCORE_CLAMP) {
    return -NNUE_SCORE_CLAMP;
  }
  return value;
}

function evaluateMaxThinking(state: GameState, context: EvalContext): number {
  const squares = context.squares;
  return (
    kingSafetyScore(state, squares, 'w') -
    kingSafetyScore(state, squares, 'b') +
    maxKingShieldScore(state, context, 'w') -
    maxKingShieldScore(state, context, 'b') +
    earlyQueenScore(state, squares, 'w') -
    earlyQueenScore(state, squares, 'b') +
    pieceSquareScore(state, context, 'w') -
    pieceSquareScore(state, context, 'b') +
    bishopPairScore(context, 'w') -
    bishopPairScore(context, 'b') +
    passedPawnKingProximity(state, context, 'w') -
    passedPawnKingProximity(state, context, 'b') +
    kingEndgamePst(state, context, 'w') -
    kingEndgamePst(state, context, 'b') +
    loneKingMatingScore(state, context, 'w') -
    loneKingMatingScore(state, context, 'b') +
    knightOutpostScore(state, context, 'w') -
    knightOutpostScore(state, context, 'b')
  );
}

function getPhaseFactor(fullmoveNumber: number): number {
  if (fullmoveNumber <= KING_PHASE_START) {
    return 0;
  }
  if (fullmoveNumber >= KING_PHASE_END) {
    return 1;
  }
  return (fullmoveNumber - KING_PHASE_START) / (KING_PHASE_END - KING_PHASE_START);
}

function calculateGamePhase(state: GameState): number {
  let phase = 0;
  for (const piece of state.pieces.values()) {
    switch (piece.type) {
      case 'queen': phase += PHASE_QUEEN; break;
      case 'rook': phase += PHASE_ROOK; break;
      case 'bishop': phase += PHASE_BISHOP; break;
      case 'knight': phase += PHASE_KNIGHT; break;
    }
  }
  return Math.min(phase, TOTAL_PHASE);
}

function taper(opening: number, endgame: number, phase: number): number {
  return (opening * phase + endgame * (TOTAL_PHASE - phase)) / TOTAL_PHASE;
}

function kingExposureScore(state: GameState, context: EvalContext, color: Color): number {
  if (context.phaseFactor <= 0) {
    return 0;
  }
  const kingSquare = findKingSquare(state, color);
  if (!kingSquare) {
    return 0;
  }
  const homeRank = color === 'w' ? 0 : 7;
  const castled =
    (color === 'w' &&
      kingSquare.rank === 0 &&
      (kingSquare.file === 2 || kingSquare.file === 6)) ||
    (color === 'b' &&
      kingSquare.rank === 7 &&
      (kingSquare.file === 2 || kingSquare.file === 6));
  const onStart = kingSquare.file === 4 && kingSquare.rank === homeRank;
  const hasCastlingRights =
    color === 'w'
      ? state.castlingRights.wK || state.castlingRights.wQ
      : state.castlingRights.bK || state.castlingRights.bQ;
  const queenMultiplier =
    context.queenCount > 0 ? KING_QUEEN_PRESENT_MULTIPLIER : 1;

  let penalty = 0;
  if (!castled && !onStart) {
    penalty -= KING_UNCASTLED_PENALTY;
  }
  const isCentralFile = kingSquare.file >= 2 && kingSquare.file <= 4;
  if (!hasCastlingRights && isCentralFile) {
    penalty -= KING_CENTRAL_PENALTY;
  }

  return penalty * context.phaseFactor * queenMultiplier;
}

function filePressureScore(state: GameState, context: EvalContext): number {
  const whiteKing = findKingSquare(state, 'w');
  const blackKing = findKingSquare(state, 'b');
  if (!whiteKing || !blackKing) {
    return 0;
  }
  const phaseScale = 0.5 + 0.5 * context.phaseFactor;
  const queenMultiplier =
    context.queenCount > 0 ? KING_QUEEN_PRESENT_MULTIPLIER : 1;
  const isOpenFile = (file: number) =>
    !context.pawnFiles.w[file] && !context.pawnFiles.b[file];
  const isSemiOpenFile = (file: number, color: Color) =>
    !context.pawnFiles[color][file] && context.pawnFiles[opponentColor(color)][file];

  let score = 0;
  for (const piece of state.pieces.values()) {
    if (piece.type !== 'rook' && piece.type !== 'queen') {
      continue;
    }
    const square = context.squares.get(piece.id);
    if (!square) {
      continue;
    }
    const file = square.file;
    const open = isOpenFile(file);
    const semiOpen = isSemiOpenFile(file, piece.color);
    if (!open && !semiOpen) {
      continue;
    }
    const targetFile = piece.color === 'w' ? blackKing.file : whiteKing.file;
    if (Math.abs(file - targetFile) > 1) {
      continue;
    }
    const bonus =
      piece.type === 'rook'
        ? open
          ? ROOK_OPEN_FILE_BONUS
          : ROOK_SEMI_OPEN_FILE_BONUS
        : open
          ? QUEEN_OPEN_FILE_BONUS
          : QUEEN_SEMI_OPEN_FILE_BONUS;
    score += (piece.color === 'w' ? bonus : -bonus) * phaseScale;
  }

  if (isOpenFile(whiteKing.file)) {
    if (hasRookQueenOnFile(context.rookQueenFiles.b, whiteKing.file)) {
      score -= KING_OPEN_FILE_PENALTY * phaseScale * queenMultiplier;
    }
  }
  if (isOpenFile(blackKing.file)) {
    if (hasRookQueenOnFile(context.rookQueenFiles.w, blackKing.file)) {
      score += KING_OPEN_FILE_PENALTY * phaseScale * queenMultiplier;
    }
  }

  return score;
}

function pawnStructureScore(context: EvalContext, color: Color): number {
  const opp = opponentColor(color);
  const phase = context.gamePhase;
  let score = 0;

  for (let file = 0; file < 8; file += 1) {
    const count = context.pawnFiles[color][file];
    if (count === 0) {
      continue;
    }

    // Doubled pawns: penalty for each extra pawn on the same file
    if (count > 1) {
      score -= (count - 1) * taper(DOUBLED_PAWN_PENALTY_OPENING, DOUBLED_PAWN_PENALTY_ENDGAME, phase);
    }

    // Isolated pawns: no friendly pawns on adjacent files
    const hasLeftNeighbor = file > 0 && context.pawnFiles[color][file - 1] > 0;
    const hasRightNeighbor = file < 7 && context.pawnFiles[color][file + 1] > 0;
    if (!hasLeftNeighbor && !hasRightNeighbor) {
      score -= count * taper(ISOLATED_PAWN_PENALTY_OPENING, ISOLATED_PAWN_PENALTY_ENDGAME, phase);
    }

    // Passed pawns: check each pawn on this file
    const ranks = context.pawnRanks[color][file];
    for (const rank of ranks) {
      if (isPassedPawn(context, color, file, rank, opp)) {
        score += passedPawnBonus(color, rank, phase);
        context.passedPawns[color].push({ file, rank });
      }
    }
  }

  // Connected passed pawns: bonus for passed pawns on adjacent files
  score += connectedPassedPawnBonus(context.passedPawns[color], color, phase);

  return score;
}

function isPassedPawn(
  context: EvalContext,
  color: Color,
  file: number,
  rank: number,
  opp: Color
): boolean {
  for (const f of [file - 1, file, file + 1]) {
    if (f < 0 || f > 7) {
      continue;
    }
    const oppRanks = context.pawnRanks[opp][f];
    for (const oppRank of oppRanks) {
      // For white: opponent pawn blocks if on rank >= this pawn's rank
      // For black: opponent pawn blocks if on rank <= this pawn's rank
      if (color === 'w' && oppRank >= rank) {
        return false;
      }
      if (color === 'b' && oppRank <= rank) {
        return false;
      }
    }
  }
  return true;
}

function passedPawnBonus(color: Color, rank: number, phase: number): number {
  // For white: advancement from rank 1 toward rank 7. Rank 4+ gets scaling bonus.
  // For black: advancement from rank 6 toward rank 0. Rank 3- gets scaling bonus.
  const advancedRanks = color === 'w'
    ? Math.max(0, rank - 3)
    : Math.max(0, 4 - rank);

  return taper(PASSED_PAWN_BASE_BONUS_OPENING, PASSED_PAWN_BASE_BONUS_ENDGAME, phase)
    + advancedRanks * taper(PASSED_PAWN_RANK_BONUS_OPENING, PASSED_PAWN_RANK_BONUS_ENDGAME, phase);
}

function connectedPassedPawnBonus(
  passedPawns: { file: number; rank: number }[],
  color: Color,
  phase: number
): number {
  if (passedPawns.length < 2) {
    return 0;
  }
  let bonus = 0;
  const sorted = passedPawns.slice().sort((a, b) => a.file - b.file);
  for (let i = 0; i < sorted.length - 1; i += 1) {
    if (sorted[i + 1].file - sorted[i].file === 1) {
      const moreAdvanced = color === 'w'
        ? Math.max(sorted[i].rank, sorted[i + 1].rank)
        : Math.min(sorted[i].rank, sorted[i + 1].rank);
      const advancedRanks = color === 'w'
        ? Math.max(0, moreAdvanced - 3)
        : Math.max(0, 4 - moreAdvanced);
      bonus += taper(CONNECTED_PASSED_PAWN_BONUS_OPENING, CONNECTED_PASSED_PAWN_BONUS_ENDGAME, phase)
        + advancedRanks * taper(CONNECTED_PASSED_PAWN_RANK_BONUS_OPENING, CONNECTED_PASSED_PAWN_RANK_BONUS_ENDGAME, phase);
    }
  }
  return bonus;
}

function chebyshevDistance(
  f1: number, r1: number,
  f2: number, r2: number
): number {
  return Math.max(Math.abs(f1 - f2), Math.abs(r1 - r2));
}

function passedPawnKingProximity(
  state: GameState,
  context: EvalContext,
  color: Color
): number {
  const pawns = context.passedPawns[color];
  if (pawns.length === 0) return 0;

  const opp = opponentColor(color);
  const friendlyKing = findKingSquare(state, color);
  const enemyKing = findKingSquare(state, opp);
  if (!friendlyKing || !enemyKing) return 0;

  let score = 0;
  for (const pawn of pawns) {
    const friendlyDist = chebyshevDistance(
      friendlyKing.file, friendlyKing.rank,
      pawn.file, pawn.rank
    );
    const enemyDist = chebyshevDistance(
      enemyKing.file, enemyKing.rank,
      pawn.file, pawn.rank
    );

    // Bonus when enemy king is far from our passed pawn (can't block)
    const enemyFarBonus = Math.min(Math.max(enemyDist - 2, 0), 4)
      * PASSED_PAWN_ENEMY_KING_DIST_SCALE;

    // Bonus when friendly king is close to our passed pawn (supporting)
    const friendlyCloseBonus = Math.min(Math.max(4 - friendlyDist, 0), 4)
      * PASSED_PAWN_FRIENDLY_KING_CLOSE_SCALE;

    score += taper(0, enemyFarBonus + friendlyCloseBonus, context.gamePhase);
  }
  return score;
}

function bishopPairScore(context: EvalContext, color: Color): number {
  if (context.bishopCount[color] >= 2) {
    const opp = opponentColor(color);
    if (context.bishopCount[opp] < 2) {
      return BISHOP_PAIR_BONUS;
    }
  }
  return 0;
}

function rookOn7thScore(state: GameState, context: EvalContext, color: Color): number {
  const seventhRank = color === 'w' ? 6 : 1;
  const eighthRank = color === 'w' ? 7 : 0;
  const opp = opponentColor(color);
  const oppKingSquare = findKingSquare(state, opp);
  const oppKingOnBackRank = oppKingSquare !== null && oppKingSquare.rank === eighthRank;

  let score = 0;
  for (const sq of context.rookSquares[color]) {
    if (sq.rank === seventhRank) {
      score += taper(ROOK_ON_7TH_BONUS_OPENING, ROOK_ON_7TH_BONUS_ENDGAME, context.gamePhase);
      if (oppKingOnBackRank) {
        score += ROOK_ON_7TH_KING_TRAPPED_BONUS;
      }
    }
  }
  return score;
}

function kingRingPenaltyScore(
  state: GameState,
  context: EvalContext,
  color: Color
): number {
  if (!ENABLE_KING_RING_ATTACK_PENALTY) {
    return 0;
  }
  if (context.queenCount <= 0) {
    return 0;
  }
  const kingSquare = findKingSquare(state, color);
  if (!kingSquare) {
    return 0;
  }
  const ringSquares = getKingRingSquares(kingSquare);
  if (ringSquares.length === 0) {
    return 0;
  }
  const attackCount = countRingAttacks(state, ringSquares, opponentColor(color));
  if (attackCount <= 0) {
    return 0;
  }
  const phaseScale = 1 - (1 - KING_RING_ENDGAME_SCALE) * context.phaseFactor;
  return attackCount * KING_RING_ATTACK_PENALTY_CP * phaseScale;
}

function getKingRingSquares(square: { file: number; rank: number }): { file: number; rank: number }[] {
  const squares: { file: number; rank: number }[] = [];
  for (let fileOffset = -1; fileOffset <= 1; fileOffset += 1) {
    for (let rankOffset = -1; rankOffset <= 1; rankOffset += 1) {
      if (fileOffset === 0 && rankOffset === 0) {
        continue;
      }
      const file = square.file + fileOffset;
      const rank = square.rank + rankOffset;
      if (file < 0 || file > 7 || rank < 0 || rank > 7) {
        continue;
      }
      squares.push({ file, rank });
    }
  }
  return squares;
}

function isInside(file: number, rank: number): boolean {
  return file >= 0 && file <= 7 && rank >= 0 && rank <= 7;
}

function countRingAttacks(
  state: GameState,
  ringSquares: { file: number; rank: number }[],
  byColor: Color
): number {
  let count = 0;
  for (const square of ringSquares) {
    count += countAttackersOnSquare(state, square, byColor);
  }
  return count;
}

function countAttackersOnSquare(
  state: GameState,
  square: { file: number; rank: number },
  byColor: Color
): number {
  let count = 0;
  const dir = byColor === 'w' ? 1 : -1;
  const pawnRank = square.rank - dir;
  for (const fileDelta of [-1, 1]) {
    const file = square.file + fileDelta;
    if (!isInside(file, pawnRank)) {
      continue;
    }
    const id = state.board[pawnRank]?.[file];
    if (!id) {
      continue;
    }
    const piece = state.pieces.get(id);
    if (piece && piece.color === byColor && piece.type === 'pawn') {
      count += 1;
    }
  }

  const knightOffsets = [
    [1, 2],
    [2, 1],
    [-1, 2],
    [-2, 1],
    [1, -2],
    [2, -1],
    [-1, -2],
    [-2, -1]
  ];
  for (const [dx, dy] of knightOffsets) {
    const file = square.file + dx;
    const rank = square.rank + dy;
    if (!isInside(file, rank)) {
      continue;
    }
    const id = state.board[rank]?.[file];
    if (!id) {
      continue;
    }
    const piece = state.pieces.get(id);
    if (piece && piece.color === byColor && piece.type === 'knight') {
      count += 1;
    }
  }

  count += countAttacksOnLine(state, square, byColor, [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ], ['rook', 'queen']);
  count += countAttacksOnLine(state, square, byColor, [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1]
  ], ['bishop', 'queen']);

  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      if (dx === 0 && dy === 0) {
        continue;
      }
      const file = square.file + dx;
      const rank = square.rank + dy;
      if (!isInside(file, rank)) {
        continue;
      }
      const id = state.board[rank]?.[file];
      if (!id) {
        continue;
      }
      const piece = state.pieces.get(id);
      if (piece && piece.color === byColor && piece.type === 'king') {
        count += 1;
      }
    }
  }

  return count;
}

function countAttacksOnLine(
  state: GameState,
  square: { file: number; rank: number },
  byColor: Color,
  directions: number[][],
  types: PieceType[]
): number {
  let count = 0;
  for (const [dx, dy] of directions) {
    let file = square.file + dx;
    let rank = square.rank + dy;
    while (isInside(file, rank)) {
      const id = state.board[rank]?.[file];
      if (id) {
        const piece = state.pieces.get(id);
        if (piece && piece.color === byColor && types.includes(piece.type)) {
          count += 1;
        }
        break;
      }
      file += dx;
      rank += dy;
    }
  }
  return count;
}

function maxKingShieldScore(state: GameState, context: EvalContext, color: Color): number {
  if (context.phaseFactor <= 0) {
    return 0;
  }
  const kingSquare = findKingSquare(state, color);
  if (!kingSquare) {
    return 0;
  }
  const queenMultiplier =
    context.queenCount > 0 ? KING_QUEEN_PRESENT_MULTIPLIER : 1;
  let missing = 0;
  for (const file of [kingSquare.file - 1, kingSquare.file, kingSquare.file + 1]) {
    if (file < 0 || file > 7) {
      continue;
    }
    if (!context.pawnFiles[color][file]) {
      missing += 1;
    }
  }
  return -missing * MAX_KING_RING_PAWN_PENALTY * context.phaseFactor * queenMultiplier;
}

function hasRookQueenOnFile(files: boolean[], file: number): boolean {
  for (const offset of [-1, 0, 1]) {
    const target = file + offset;
    if (target < 0 || target > 7) {
      continue;
    }
    if (files[target]) {
      return true;
    }
  }
  return false;
}

function opponentColor(color: Color): Color {
  return color === 'w' ? 'b' : 'w';
}

function kingSafetyScore(
  state: GameState,
  squares: Map<number, { file: number; rank: number }>,
  color: Color
): number {
  const kingSquare = findKingSquare(state, color);
  if (!kingSquare) {
    return 0;
  }

  const isOpening = state.fullmoveNumber <= OPENING_FULLMOVE_LIMIT;
  if (!isOpening) {
    return 0;
  }

  const homeRank = color === 'w' ? 0 : 7;
  const homeSquare = { file: 4, rank: homeRank };
  const castled =
    (color === 'w' && kingSquare.rank === 0 && (kingSquare.file === 2 || kingSquare.file === 6)) ||
    (color === 'b' && kingSquare.rank === 7 && (kingSquare.file === 2 || kingSquare.file === 6));

  let score = 0;
  if (castled) {
    score += KING_CASTLED_BONUS;
  } else if (kingSquare.file === homeSquare.file && kingSquare.rank === homeSquare.rank) {
    score += KING_HOME_BONUS;
  }

  if (!castled) {
    const distance =
      Math.abs(kingSquare.file - homeSquare.file) +
      Math.abs(kingSquare.rank - homeSquare.rank);
    if (distance > 0) {
      score -= distance * KING_MOVE_PENALTY;
    }
  }

  let missingShield = 0;
  for (const file of [5, 6, 7]) {
    if (!hasPawnOnFile(state, squares, color, file)) {
      missingShield += 1;
    }
  }
  score -= missingShield * PAWN_SHIELD_PENALTY;
  return score;
}

function earlyQueenScore(
  state: GameState,
  squares: Map<number, { file: number; rank: number }>,
  color: Color
): number {
  if (state.fullmoveNumber > OPENING_FULLMOVE_LIMIT) {
    return 0;
  }

  const queenEntry = [...state.pieces.values()].find(
    (piece) => piece.color === color && piece.type === 'queen'
  );
  if (!queenEntry) {
    return 0;
  }

  const queenSquare = squares.get(queenEntry.id);
  if (!queenSquare) {
    return 0;
  }

  const queenStart =
    color === 'w' ? { file: 3, rank: 0 } : { file: 3, rank: 7 };
  const queenMoved =
    queenEntry.hasMoved ||
    queenSquare.file !== queenStart.file ||
    queenSquare.rank !== queenStart.rank;

  if (!queenMoved) {
    return 0;
  }

  const developedMinors = countDevelopedMinors(state, squares, color);
  if (developedMinors >= 2) {
    return 0;
  }

  const fade =
    (OPENING_FULLMOVE_LIMIT - state.fullmoveNumber + 1) / OPENING_FULLMOVE_LIMIT;
  return -EARLY_QUEEN_PENALTY * Math.max(0, fade);
}

function pieceSquareScore(
  state: GameState,
  context: EvalContext,
  color: Color
): number {
  let score = 0;
  for (const piece of state.pieces.values()) {
    if (piece.color !== color) continue;
    if (piece.type !== 'knight' && piece.type !== 'bishop') continue;
    const square = context.squares.get(piece.id);
    if (!square) continue;
    const index =
      color === 'w'
        ? square.rank * 8 + square.file
        : (7 - square.rank) * 8 + square.file;
    if (piece.type === 'knight') {
      score += taper(KNIGHT_PST_OPENING[index], KNIGHT_PST_ENDGAME[index], context.gamePhase);
    } else {
      score += taper(BISHOP_PST_OPENING[index], BISHOP_PST_ENDGAME[index], context.gamePhase);
    }
  }
  return score;
}

function kingEndgamePst(
  state: GameState,
  context: EvalContext,
  color: Color
): number {
  const kingSquare = findKingSquare(state, color);
  if (!kingSquare) return 0;
  const index =
    color === 'w'
      ? kingSquare.rank * 8 + kingSquare.file
      : (7 - kingSquare.rank) * 8 + kingSquare.file;
  return taper(0, KING_PST_ENDGAME[index], context.gamePhase);
}

function knightOutpostScore(
  state: GameState,
  context: EvalContext,
  color: Color
): number {
  const opp = opponentColor(color);
  const outpostMinRank = color === 'w' ? 3 : 2;
  const outpostMaxRank = color === 'w' ? 5 : 4;
  const supportRankDir = color === 'w' ? -1 : 1;
  let score = 0;
  for (const piece of state.pieces.values()) {
    if (piece.type !== 'knight' || piece.color !== color) continue;
    const sq = context.squares.get(piece.id);
    if (!sq || sq.rank < outpostMinRank || sq.rank > outpostMaxRank) continue;

    // Supported by friendly pawn on diagonal behind?
    const supportRank = sq.rank + supportRankDir;
    const leftFile = sq.file - 1;
    const rightFile = sq.file + 1;
    const leftSupport = leftFile >= 0 && context.pawnRanks[color][leftFile].includes(supportRank);
    const rightSupport = rightFile <= 7 && context.pawnRanks[color][rightFile].includes(supportRank);
    if (!leftSupport && !rightSupport) continue;

    // No enemy pawns on adjacent files that could attack (ahead of the knight)
    let canBeAttacked = false;
    for (const adjFile of [leftFile, rightFile]) {
      if (adjFile < 0 || adjFile > 7) continue;
      for (const r of context.pawnRanks[opp][adjFile]) {
        if (color === 'w' ? r > sq.rank : r < sq.rank) {
          canBeAttacked = true;
          break;
        }
      }
      if (canBeAttacked) break;
    }
    if (!canBeAttacked) {
      score += KNIGHT_OUTPOST_BONUS;
    }
  }
  return score;
}

function loneKingMatingScore(
  state: GameState,
  context: EvalContext,
  winnerColor: Color
): number {
  const loserColor = opponentColor(winnerColor);

  // Check if opponent has only a king
  let loserHasOtherPieces = false;
  let winnerHasMajor = false;
  for (const piece of state.pieces.values()) {
    if (piece.color === loserColor && piece.type !== 'king') {
      loserHasOtherPieces = true;
      break;
    }
    if (piece.color === winnerColor && (piece.type === 'queen' || piece.type === 'rook')) {
      winnerHasMajor = true;
    }
  }
  if (loserHasOtherPieces || !winnerHasMajor) return 0;

  const enemyKing = findKingSquare(state, loserColor);
  const friendlyKing = findKingSquare(state, winnerColor);
  if (!enemyKing || !friendlyKing) return 0;

  // Edge distance: reward enemy king on edge/corner
  const edgeDist = Math.min(
    enemyKing.file, 7 - enemyKing.file,
    enemyKing.rank, 7 - enemyKing.rank
  );
  const edgeBonus = (3 - edgeDist) * LONE_KING_EDGE_BONUS;

  // Corner proximity: extra reward near nearest corner
  const cornerFile = enemyKing.file <= 3 ? 0 : 7;
  const cornerRank = enemyKing.rank <= 3 ? 0 : 7;
  const cornerDist = chebyshevDistance(
    enemyKing.file, enemyKing.rank, cornerFile, cornerRank
  );
  const cornerBonus = Math.max(0, 3 - cornerDist) * LONE_KING_CORNER_BONUS;

  // King proximity: reward friendly king close to enemy king
  const kingDist = chebyshevDistance(
    friendlyKing.file, friendlyKing.rank,
    enemyKing.file, enemyKing.rank
  );
  const closeBonus = Math.max(0, 7 - kingDist) * LONE_KING_CLOSE_KING_BONUS;

  return edgeBonus + cornerBonus + closeBonus;
}

function countDevelopedMinors(
  state: GameState,
  squares: Map<number, { file: number; rank: number }>,
  color: Color
): number {
  const startSquares =
    color === 'w'
      ? {
          bishop: [
            { file: 2, rank: 0 },
            { file: 5, rank: 0 }
          ],
          knight: [
            { file: 1, rank: 0 },
            { file: 6, rank: 0 }
          ]
        }
      : {
          bishop: [
            { file: 2, rank: 7 },
            { file: 5, rank: 7 }
          ],
          knight: [
            { file: 1, rank: 7 },
            { file: 6, rank: 7 }
          ]
        };

  let developed = 0;
  for (const piece of state.pieces.values()) {
    if (piece.color !== color) {
      continue;
    }
    if (piece.type !== 'bishop' && piece.type !== 'knight') {
      continue;
    }
    const square = squares.get(piece.id);
    if (!square) {
      continue;
    }
    const starts = startSquares[piece.type];
    const isStart = starts.some(
      (start) => start.file === square.file && start.rank === square.rank
    );
    if (piece.hasMoved || !isStart) {
      developed += 1;
    }
  }
  return developed;
}

function hasPawnOnFile(
  state: GameState,
  squares: Map<number, { file: number; rank: number }>,
  color: Color,
  file: number
): boolean {
  for (const piece of state.pieces.values()) {
    if (piece.color !== color || piece.type !== 'pawn') {
      continue;
    }
    const square = squares.get(piece.id);
    if (square && square.file === file) {
      return true;
    }
  }
  return false;
}
