import { Color, GameState, GameStatus, PieceType } from './rules';

export type GameSummary = {
  title: string;
  outcome: string;
  material: string;
  detail: string;
};

type Scores = { w: number; b: number };

const INITIAL_COUNTS: Record<PieceType, number> = {
  pawn: 8,
  knight: 2,
  bishop: 2,
  rook: 2,
  queen: 1,
  king: 1
};

export function createGameSummary(
  state: GameState,
  status: GameStatus,
  scores: Scores
): GameSummary | null {
  if (
    status.status !== 'checkmate' &&
    status.status !== 'stalemate' &&
    status.status !== 'draw'
  ) {
    return null;
  }

  const winner = status.status === 'checkmate' ? status.winner : null;
  const winnerLabel = winner ? colorLabel(winner) : 'Draw';
  const outcome = buildOutcome(status, winnerLabel);
  const material = `Material score: White ${scores.w} - Black ${scores.b}`;

  const diff = scores.w - scores.b;
  const advantage = diff > 0 ? 'w' : diff < 0 ? 'b' : null;
  const notableLosses = winner ? describeNotableLosses(state, opponent(winner)) : '';

  let detail = '';
  if (status.status === 'checkmate' && winner) {
    if (Math.abs(diff) >= 3 && advantage === winner) {
      detail = `${winnerLabel} converted a material advantage${notableLosses} and delivered checkmate.`;
    } else {
      detail = `${winnerLabel} forced checkmate with roughly even material${notableLosses}.`;
    }
  } else if (status.status === 'stalemate') {
    if (advantage) {
      detail = `Drawn by stalemate despite ${colorLabel(advantage)} holding a material edge.`;
    } else {
      detail = 'Drawn by stalemate with roughly even material.';
    }
  } else if (status.status === 'draw') {
    if (status.reason) {
      detail = `Draw by ${status.reason}.`;
    } else {
      detail = 'Draw by agreement.';
    }
  }

  return {
    title: status.status === 'checkmate' ? 'Checkmate' : 'Draw',
    outcome,
    material,
    detail
  };
}

function buildOutcome(status: GameStatus, winnerLabel: string): string {
  if (status.status === 'checkmate') {
    return `Winner: ${winnerLabel}`;
  }
  if (status.status === 'stalemate') {
    return 'Result: Draw (stalemate)';
  }
  if (status.status === 'draw') {
    return status.reason ? `Result: Draw (${status.reason})` : 'Result: Draw';
  }
  return 'Result: Draw';
}

function colorLabel(color: Color): string {
  return color === 'w' ? 'White' : 'Black';
}

function opponent(color: Color): Color {
  return color === 'w' ? 'b' : 'w';
}

function describeNotableLosses(state: GameState, color: Color): string {
  const counts = countPieces(state, color);
  const missing: Partial<Record<PieceType, number>> = {};

  for (const type of Object.keys(INITIAL_COUNTS) as PieceType[]) {
    const initial = INITIAL_COUNTS[type];
    const current = counts[type] ?? 0;
    const loss = Math.max(0, initial - current);
    if (loss > 0) {
      missing[type] = loss;
    }
  }

  const parts: string[] = [];
  if (missing.queen) {
    parts.push(formatPieceLoss('queen', missing.queen));
  }
  if (missing.rook) {
    parts.push(formatPieceLoss('rook', missing.rook));
  }
  if (missing.bishop) {
    parts.push(formatPieceLoss('bishop', missing.bishop));
  }
  if (missing.knight) {
    parts.push(formatPieceLoss('knight', missing.knight));
  }

  if (parts.length === 0) {
    return '';
  }

  return ` after winning ${formatList(parts)}`;
}

function countPieces(state: GameState, color: Color): Record<PieceType, number> {
  const counts: Record<PieceType, number> = {
    pawn: 0,
    knight: 0,
    bishop: 0,
    rook: 0,
    queen: 0,
    king: 0
  };

  for (const piece of state.pieces.values()) {
    if (piece.color === color) {
      counts[piece.type] += 1;
    }
  }

  return counts;
}

function formatPieceLoss(type: PieceType, count: number): string {
  const label = type === 'knight' ? 'knight' : type;
  if (count === 1) {
    return `a ${label}`;
  }
  return `${count} ${label}s`;
}

function formatList(items: string[]): string {
  if (items.length === 1) {
    return items[0];
  }
  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}
