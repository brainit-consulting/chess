import {
  Color,
  GameState,
  Move,
  Piece,
  PieceType,
  applyMove,
  getAllLegalMoves,
  getGameStatus,
  getLegalMovesForSquare,
  getPieceAt,
  getPositionKey,
  isInCheck
} from '../rules';
import { PIECE_VALUES } from './evaluate';
import { AiExplainOptions, AiExplainResult } from './aiWorkerTypes';

const PIECE_NAMES: Record<PieceType, string> = {
  pawn: 'Pawn',
  knight: 'Knight',
  bishop: 'Bishop',
  rook: 'Rook',
  queen: 'Queen',
  king: 'King'
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

export function explainMove(
  state: GameState,
  move: Move,
  options: AiExplainOptions = {}
): AiExplainResult {
  const mover = getPieceAt(state, move.from);
  const moverColor = mover?.color ?? state.activeColor;
  const moverName = mover ? PIECE_NAMES[mover.type] : 'Piece';
  const moveLabel = formatMoveLabel(state, move, moverName);

  const beforeMaterial = materialForColor(state, moverColor);
  const inCheckBefore = isInCheck(state, moverColor);

  const next = cloneState(state);
  next.activeColor = moverColor;
  applyMove(next, move);

  const status = getGameStatus(next);
  const inCheckAfter = isInCheck(next, moverColor);

  const bullets: string[] = [];
  const tags: string[] = [];

  if (status.status === 'checkmate') {
    bullets.push('Checkmate — the king has no legal escape.');
    tags.push('checkmate');
  } else if (status.status === 'check') {
    bullets.push('Gives check to the king.');
    tags.push('check');
  }

  if (inCheckBefore && !inCheckAfter) {
    bullets.push('Gets out of check.');
    tags.push('escape');
  }

  if (move.isEnPassant) {
    bullets.push('En passant: captures the pawn that just advanced two squares.');
    tags.push('en-passant');
  } else if (move.capturedId) {
    const captured = state.pieces.get(move.capturedId);
    const capturedName = captured ? PIECE_NAMES[captured.type] : 'piece';
    bullets.push(`Captures a ${capturedName.toLowerCase()} (wins material).`);
    tags.push('capture');
  }

  if (move.promotion) {
    bullets.push(`Promotes a pawn to a ${PIECE_NAMES[move.promotion].toLowerCase()}.`);
    tags.push('promotion');
  }

  if (move.isCastle) {
    bullets.push('Castles: moves the king to safety and activates the rook.');
    tags.push('castle');
  }

  const afterMaterial = materialForColor(next, moverColor);
  const delta = afterMaterial - beforeMaterial;
  if (delta > 0) {
    bullets.push(`Improves material by +${formatPawnDelta(delta)}.`);
    tags.push('material');
  }

  const captureThreat = findCaptureThreat(next, move.to, moverColor);
  if (captureThreat) {
    bullets.push(`Creates a capture threat against a ${captureThreat.toLowerCase()}.`);
    tags.push('threat');
  }

  const mobilityDelta = getMobilityDelta(state, next, moverColor);
  if (mobilityDelta >= 2) {
    bullets.push(`Increases available moves by +${mobilityDelta}.`);
    tags.push('mobility');
  }

  if (options.playForWin && options.recentPositions?.length) {
    const nextKey = getPositionKey(next);
    if (!options.recentPositions.includes(nextKey)) {
      const legalMoves = getAllLegalMoves(state, moverColor);
      const hasRepeat = legalMoves.some((candidate) => {
        const probe = cloneState(state);
        probe.activeColor = moverColor;
        applyMove(probe, candidate);
        const key = getPositionKey(probe);
        return options.recentPositions?.includes(key);
      });
      if (hasRepeat) {
        bullets.push('Avoids repeating positions to reduce draw loops.');
        tags.push('avoid-repeat');
      }
    }
  }

  const summary = bullets.length > 0 ? `What it does: ${bullets[0]}` : '';

  return {
    title: 'Why this move?',
    moveLabel,
    bullets,
    summary,
    tags
  };
}

function formatMoveLabel(state: GameState, move: Move, moverName: string): string {
  const from = squareToLabel(move.from);
  const to = squareToLabel(move.to);
  const isCapture = Boolean(move.capturedId || move.isEnPassant);
  const separator = isCapture ? 'x' : '-';
  let label = `${moverName} ${from}${separator}${to}`;

  if (move.promotion) {
    label += `=${PIECE_NAMES[move.promotion]}`;
  }

  if (move.isCastle) {
    label += ' (castling)';
  }

  if (move.isEnPassant) {
    label += ' (en passant)';
  }

  return label;
}

function squareToLabel(square: { file: number; rank: number }): string {
  return `${FILES[square.file]}${square.rank + 1}`;
}

function materialForColor(state: GameState, color: Color): number {
  let total = 0;
  for (const piece of state.pieces.values()) {
    const value = PIECE_VALUES[piece.type] ?? 0;
    total += piece.color === color ? value : 0;
  }
  return total;
}

function formatPawnDelta(delta: number): string {
  const value = delta / 100;
  const rounded = Math.round(value * 10) / 10;
  return rounded % 1 === 0 ? `${rounded.toFixed(0)}` : `${rounded.toFixed(1)}`;
}

function findCaptureThreat(
  state: GameState,
  square: { file: number; rank: number },
  moverColor: Color
): string | null {
  const moves = getLegalMovesForSquare(state, square);
  let bestType: PieceType | null = null;
  for (const candidate of moves) {
    if (candidate.isEnPassant) {
      if (!bestType || PIECE_VALUES.pawn > PIECE_VALUES[bestType]) {
        bestType = 'pawn';
      }
      continue;
    }
    const target = getPieceAt(state, candidate.to);
    if (!target || target.color === moverColor) {
      continue;
    }
    if (!bestType || PIECE_VALUES[target.type] > PIECE_VALUES[bestType]) {
      bestType = target.type;
    }
  }
  return bestType ? PIECE_NAMES[bestType] : null;
}

function getMobilityDelta(before: GameState, after: GameState, color: Color): number {
  const beforeMoves = getAllLegalMoves(before, color).length;
  const afterMoves = getAllLegalMoves(after, color).length;
  return afterMoves - beforeMoves;
}

function cloneState(state: GameState): GameState {
  const board = state.board.map((row) => row.slice());
  const pieces = new Map<number, Piece>();
  for (const [id, piece] of state.pieces) {
    pieces.set(id, { ...piece });
  }
  return {
    board,
    pieces,
    activeColor: state.activeColor,
    castlingRights: { ...state.castlingRights },
    enPassantTarget: state.enPassantTarget ? { ...state.enPassantTarget } : null,
    halfmoveClock: state.halfmoveClock,
    fullmoveNumber: state.fullmoveNumber,
    lastMove: state.lastMove ? { ...state.lastMove } : null
  };
}
