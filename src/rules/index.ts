export type Color = 'w' | 'b';
export type PieceType = 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn';

export interface Square {
  file: number;
  rank: number;
}

export interface Piece {
  id: number;
  type: PieceType;
  color: Color;
  hasMoved: boolean;
}

export interface Move {
  from: Square;
  to: Square;
  promotion?: PieceType;
  isCastle?: boolean;
  isEnPassant?: boolean;
  capturedId?: number;
}

export interface CastlingRights {
  wK: boolean;
  wQ: boolean;
  bK: boolean;
  bQ: boolean;
}

export interface GameState {
  board: (number | null)[][];
  pieces: Map<number, Piece>;
  activeColor: Color;
  castlingRights: CastlingRights;
  enPassantTarget: Square | null;
  halfmoveClock: number;
  fullmoveNumber: number;
  lastMove: Move | null;
  positionCounts?: Map<string, number>;
}

export type GameStatus = {
  status: 'ongoing' | 'check' | 'checkmate' | 'stalemate' | 'draw';
  winner?: Color;
  reason?: string;
};

const BOARD_SIZE = 8;

export function createEmptyState(): GameState {
  return {
    board: createEmptyBoard(),
    pieces: new Map(),
    activeColor: 'w',
    castlingRights: { wK: false, wQ: false, bK: false, bQ: false },
    enPassantTarget: null,
    halfmoveClock: 0,
    fullmoveNumber: 1,
    lastMove: null,
    positionCounts: new Map()
  };
}

export function addPiece(
  state: GameState,
  type: PieceType,
  color: Color,
  square: Square,
  hasMoved = false
): number {
  const id = state.pieces.size + 1;
  const piece: Piece = { id, type, color, hasMoved };
  state.pieces.set(id, piece);
  state.board[square.rank][square.file] = id;
  return id;
}

export function createInitialState(): GameState {
  const state = createEmptyState();
  const backRank: PieceType[] = [
    'rook',
    'knight',
    'bishop',
    'queen',
    'king',
    'bishop',
    'knight',
    'rook'
  ];

  for (let file = 0; file < BOARD_SIZE; file += 1) {
    addPiece(state, backRank[file], 'w', { file, rank: 0 });
    addPiece(state, 'pawn', 'w', { file, rank: 1 });
    addPiece(state, backRank[file], 'b', { file, rank: 7 });
    addPiece(state, 'pawn', 'b', { file, rank: 6 });
  }

  state.castlingRights = { wK: true, wQ: true, bK: true, bQ: true };
  ensurePositionCount(state);
  return state;
}

export function getPieceAt(state: GameState, square: Square): Piece | null {
  const id = state.board[square.rank]?.[square.file] ?? null;
  if (!id) {
    return null;
  }
  return state.pieces.get(id) || null;
}

export function getPieceSquares(state: GameState): Map<number, Square> {
  const map = new Map<number, Square>();
  for (let rank = 0; rank < BOARD_SIZE; rank += 1) {
    for (let file = 0; file < BOARD_SIZE; file += 1) {
      const id = state.board[rank][file];
      if (id) {
        map.set(id, { file, rank });
      }
    }
  }
  return map;
}

export function sameSquare(a: Square, b: Square): boolean {
  return a.file === b.file && a.rank === b.rank;
}

export function findKingSquare(state: GameState, color: Color): Square | null {
  for (let rank = 0; rank < BOARD_SIZE; rank += 1) {
    for (let file = 0; file < BOARD_SIZE; file += 1) {
      const id = state.board[rank][file];
      if (!id) {
        continue;
      }
      const piece = state.pieces.get(id);
      if (piece && piece.type === 'king' && piece.color === color) {
        return { file, rank };
      }
    }
  }
  return null;
}

export function getLegalMovesForSquare(state: GameState, square: Square): Move[] {
  const id = state.board[square.rank]?.[square.file];
  if (!id) {
    return [];
  }
  const piece = state.pieces.get(id);
  if (!piece) {
    return [];
  }

  const pseudoMoves = generatePseudoMoves(state, square, piece);
  return pseudoMoves.filter((move) => isMoveLegal(state, move, piece.color));
}

export function getAllLegalMoves(state: GameState, color: Color = state.activeColor): Move[] {
  const moves: Move[] = [];
  for (const [id, piece] of state.pieces) {
    if (piece.color !== color) {
      continue;
    }

    const square = findPieceSquare(state, id);
    if (!square) {
      continue;
    }
    moves.push(...getLegalMovesForSquare(state, square));
  }
  return moves;
}

export function applyMove(state: GameState, move: Move): GameState {
  ensurePositionCount(state);
  const movingId = state.board[move.from.rank]?.[move.from.file];
  if (!movingId) {
    throw new Error('No piece at source square.');
  }
  const movingPiece = state.pieces.get(movingId);
  if (!movingPiece) {
    throw new Error('Missing moving piece.');
  }

  const wasPawn = movingPiece.type === 'pawn';
  let capturedPiece: Piece | null = null;
  let capturedSquare: Square | null = null;

  if (move.isEnPassant) {
    const dir = movingPiece.color === 'w' ? 1 : -1;
    const targetSquare = { file: move.to.file, rank: move.to.rank - dir };
    const capturedId = state.board[targetSquare.rank]?.[targetSquare.file] ?? null;
    if (capturedId) {
      capturedPiece = state.pieces.get(capturedId) || null;
      state.pieces.delete(capturedId);
      state.board[targetSquare.rank][targetSquare.file] = null;
      move.capturedId = capturedId;
      capturedSquare = { ...targetSquare };
    }
  } else {
    const targetId = state.board[move.to.rank]?.[move.to.file] ?? null;
    if (targetId) {
      capturedPiece = state.pieces.get(targetId) || null;
      state.pieces.delete(targetId);
      move.capturedId = targetId;
      capturedSquare = { ...move.to };
    }
  }

  state.board[move.from.rank][move.from.file] = null;
  state.board[move.to.rank][move.to.file] = movingId;

  if (move.isCastle) {
    const rookFrom = move.to.file === 6 ? 7 : 0;
    const rookTo = move.to.file === 6 ? 5 : 3;
    const rookId = state.board[move.from.rank]?.[rookFrom] ?? null;
    if (rookId) {
      const rookPiece = state.pieces.get(rookId);
      state.board[move.from.rank][rookFrom] = null;
      state.board[move.from.rank][rookTo] = rookId;
      if (rookPiece) {
        rookPiece.hasMoved = true;
      }
    }
  }

  if (move.promotion && movingPiece.type === 'pawn') {
    movingPiece.type = move.promotion;
  }

  movingPiece.hasMoved = true;

  updateCastlingRights(state, movingPiece, move.from, capturedPiece, capturedSquare);

  const isPawnMove = wasPawn;
  const isCapture = capturedPiece !== null || move.isEnPassant;
  state.halfmoveClock = isPawnMove || isCapture ? 0 : state.halfmoveClock + 1;

  if (isPawnMove && Math.abs(move.to.rank - move.from.rank) === 2) {
    state.enPassantTarget = {
      file: move.from.file,
      rank: (move.from.rank + move.to.rank) / 2
    };
  } else {
    state.enPassantTarget = null;
  }

  if (state.activeColor === 'b') {
    state.fullmoveNumber += 1;
  }

  state.lastMove = cloneMove(move);
  state.activeColor = opponentColor(state.activeColor);
  recordPosition(state);

  return state;
}

export function isInCheck(state: GameState, color: Color): boolean {
  const kingSquare = findKingSquare(state, color);
  if (!kingSquare) {
    return false;
  }
  return isSquareAttacked(state, kingSquare, opponentColor(color));
}

export function getGameStatus(state: GameState): GameStatus {
  ensurePositionCount(state);
  if (getPositionCount(state) >= 3) {
    return { status: 'draw', reason: 'threefold repetition' };
  }
  if (isInsufficientMaterial(state)) {
    return { status: 'draw', reason: 'insufficient material' };
  }

  const inCheck = isInCheck(state, state.activeColor);
  const legalMoves = getAllLegalMoves(state, state.activeColor);

  if (legalMoves.length === 0) {
    if (inCheck) {
      return { status: 'checkmate', winner: opponentColor(state.activeColor) };
    }
    return { status: 'stalemate' };
  }

  return inCheck ? { status: 'check' } : { status: 'ongoing' };
}

function isInsufficientMaterial(state: GameState): boolean {
  const counts: Record<Color, Record<PieceType, number>> = {
    w: { pawn: 0, knight: 0, bishop: 0, rook: 0, queen: 0, king: 0 },
    b: { pawn: 0, knight: 0, bishop: 0, rook: 0, queen: 0, king: 0 }
  };

  for (const piece of state.pieces.values()) {
    counts[piece.color][piece.type] += 1;
  }

  const hasMajor =
    counts.w.pawn +
      counts.w.rook +
      counts.w.queen +
      counts.b.pawn +
      counts.b.rook +
      counts.b.queen >
    0;
  if (hasMajor) {
    return false;
  }

  const whiteMinors = counts.w.bishop + counts.w.knight;
  const blackMinors = counts.b.bishop + counts.b.knight;

  if (whiteMinors === 0 && blackMinors === 0) {
    return true;
  }
  if (whiteMinors === 1 && blackMinors === 0) {
    return true;
  }
  if (blackMinors === 1 && whiteMinors === 0) {
    return true;
  }

  if (
    whiteMinors === 1 &&
    blackMinors === 1 &&
    counts.w.knight === 0 &&
    counts.b.knight === 0
  ) {
    return true;
  }

  return false;
}

function createEmptyBoard(): (number | null)[][] {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
}

function findPieceSquare(state: GameState, pieceId: number): Square | null {
  for (let rank = 0; rank < BOARD_SIZE; rank += 1) {
    for (let file = 0; file < BOARD_SIZE; file += 1) {
      if (state.board[rank][file] === pieceId) {
        return { file, rank };
      }
    }
  }
  return null;
}

function generatePseudoMoves(state: GameState, square: Square, piece: Piece): Move[] {
  switch (piece.type) {
    case 'pawn':
      return generatePawnMoves(state, square, piece.color);
    case 'rook':
      return generateSlidingMoves(state, square, piece.color, [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
      ]);
    case 'bishop':
      return generateSlidingMoves(state, square, piece.color, [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1]
      ]);
    case 'queen':
      return generateSlidingMoves(state, square, piece.color, [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1]
      ]);
    case 'knight':
      return generateKnightMoves(state, square, piece.color);
    case 'king':
      return generateKingMoves(state, square, piece.color);
    default:
      return [];
  }
}

function generatePawnMoves(state: GameState, square: Square, color: Color): Move[] {
  const moves: Move[] = [];
  const dir = color === 'w' ? 1 : -1;
  const startRank = color === 'w' ? 1 : 6;
  const promotionRank = color === 'w' ? 7 : 0;

  const forwardRank = square.rank + dir;
  if (isInside(square.file, forwardRank) && !state.board[forwardRank][square.file]) {
    if (forwardRank === promotionRank) {
      moves.push(...promotionMoves(square, { file: square.file, rank: forwardRank }));
    } else {
      moves.push({ from: square, to: { file: square.file, rank: forwardRank } });
    }

    const doubleRank = square.rank + dir * 2;
    if (
      square.rank === startRank &&
      isInside(square.file, doubleRank) &&
      !state.board[doubleRank][square.file]
    ) {
      moves.push({ from: square, to: { file: square.file, rank: doubleRank } });
    }
  }

  for (const fileDelta of [-1, 1]) {
    const file = square.file + fileDelta;
    const rank = square.rank + dir;
    if (!isInside(file, rank)) {
      continue;
    }

    const targetId = state.board[rank][file];
    if (targetId) {
      const targetPiece = state.pieces.get(targetId);
      if (targetPiece && targetPiece.color !== color) {
        if (rank === promotionRank) {
          moves.push(...promotionMoves(square, { file, rank }, targetId));
        } else {
          moves.push({ from: square, to: { file, rank }, capturedId: targetId });
        }
      }
    }

    if (
      state.enPassantTarget &&
      state.enPassantTarget.file === file &&
      state.enPassantTarget.rank === rank
    ) {
      moves.push({
        from: square,
        to: { file, rank },
        isEnPassant: true
      });
    }
  }

  return moves;
}

function promotionMoves(from: Square, to: Square, capturedId?: number): Move[] {
  const types: PieceType[] = ['queen', 'rook', 'bishop', 'knight'];
  return types.map((promotion) => ({ from, to, promotion, capturedId }));
}

function generateSlidingMoves(
  state: GameState,
  square: Square,
  color: Color,
  directions: number[][]
): Move[] {
  const moves: Move[] = [];
  for (const [dx, dy] of directions) {
    let file = square.file + dx;
    let rank = square.rank + dy;
    while (isInside(file, rank)) {
      const targetId = state.board[rank][file];
      if (!targetId) {
        moves.push({ from: square, to: { file, rank } });
      } else {
        const targetPiece = state.pieces.get(targetId);
        if (targetPiece && targetPiece.color !== color) {
          moves.push({ from: square, to: { file, rank }, capturedId: targetId });
        }
        break;
      }
      file += dx;
      rank += dy;
    }
  }
  return moves;
}

function generateKnightMoves(state: GameState, square: Square, color: Color): Move[] {
  const moves: Move[] = [];
  const offsets = [
    [1, 2],
    [2, 1],
    [-1, 2],
    [-2, 1],
    [1, -2],
    [2, -1],
    [-1, -2],
    [-2, -1]
  ];

  for (const [dx, dy] of offsets) {
    const file = square.file + dx;
    const rank = square.rank + dy;
    if (!isInside(file, rank)) {
      continue;
    }
    const targetId = state.board[rank][file];
    if (!targetId) {
      moves.push({ from: square, to: { file, rank } });
      continue;
    }
    const targetPiece = state.pieces.get(targetId);
    if (targetPiece && targetPiece.color !== color) {
      moves.push({ from: square, to: { file, rank }, capturedId: targetId });
    }
  }

  return moves;
}

function generateKingMoves(state: GameState, square: Square, color: Color): Move[] {
  const moves: Move[] = [];
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
      const targetId = state.board[rank][file];
      if (!targetId) {
        moves.push({ from: square, to: { file, rank } });
      } else {
        const targetPiece = state.pieces.get(targetId);
        if (targetPiece && targetPiece.color !== color) {
          moves.push({ from: square, to: { file, rank }, capturedId: targetId });
        }
      }
    }
  }

  if (color === 'w' && square.file === 4 && square.rank === 0) {
    if (state.castlingRights.wK && canCastle(state, square, 1)) {
      moves.push({ from: square, to: { file: 6, rank: 0 }, isCastle: true });
    }
    if (state.castlingRights.wQ && canCastle(state, square, -1)) {
      moves.push({ from: square, to: { file: 2, rank: 0 }, isCastle: true });
    }
  }

  if (color === 'b' && square.file === 4 && square.rank === 7) {
    if (state.castlingRights.bK && canCastle(state, square, 1)) {
      moves.push({ from: square, to: { file: 6, rank: 7 }, isCastle: true });
    }
    if (state.castlingRights.bQ && canCastle(state, square, -1)) {
      moves.push({ from: square, to: { file: 2, rank: 7 }, isCastle: true });
    }
  }

  return moves;
}

function canCastle(state: GameState, kingSquare: Square, direction: 1 | -1): boolean {
  const rank = kingSquare.rank;
  const rookFile = direction === 1 ? 7 : 0;
  const rookId = state.board[rank]?.[rookFile] ?? null;
  if (!rookId) {
    return false;
  }
  const rook = state.pieces.get(rookId);
  if (!rook || rook.type !== 'rook') {
    return false;
  }

  const betweenFiles = direction === 1 ? [5, 6] : [1, 2, 3];
  for (const file of betweenFiles) {
    if (state.board[rank][file]) {
      return false;
    }
  }

  return true;
}

function isMoveLegal(state: GameState, move: Move, movingColor: Color): boolean {
  if (move.isCastle) {
    if (isInCheck(state, movingColor)) {
      return false;
    }
    const dir = move.to.file > move.from.file ? 1 : -1;
    const through = { file: move.from.file + dir, rank: move.from.rank };
    if (
      isSquareAttacked(state, through, opponentColor(movingColor)) ||
      isSquareAttacked(state, move.to, opponentColor(movingColor))
    ) {
      return false;
    }
  }

  const clone = cloneState(state);
  applyMove(clone, move);
  return !isInCheck(clone, movingColor);
}

function isSquareAttacked(state: GameState, square: Square, byColor: Color): boolean {
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
      return true;
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
      return true;
    }
  }

  if (
    isAttackedOnLine(
      state,
      square,
      byColor,
      [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
      ],
      ['rook', 'queen']
    )
  ) {
    return true;
  }

  if (
    isAttackedOnLine(
      state,
      square,
      byColor,
      [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1]
      ],
      ['bishop', 'queen']
    )
  ) {
    return true;
  }

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
        return true;
      }
    }
  }

  return false;
}

function isAttackedOnLine(
  state: GameState,
  square: Square,
  byColor: Color,
  directions: number[][],
  types: PieceType[]
): boolean {
  for (const [dx, dy] of directions) {
    let file = square.file + dx;
    let rank = square.rank + dy;
    while (isInside(file, rank)) {
      const id = state.board[rank]?.[file];
      if (id) {
        const piece = state.pieces.get(id);
        if (piece && piece.color === byColor && types.includes(piece.type)) {
          return true;
        }
        break;
      }
      file += dx;
      rank += dy;
    }
  }
  return false;
}

function updateCastlingRights(
  state: GameState,
  movingPiece: Piece,
  from: Square,
  capturedPiece: Piece | null,
  capturedSquare: Square | null
): void {
  if (movingPiece.type === 'king') {
    if (movingPiece.color === 'w') {
      state.castlingRights.wK = false;
      state.castlingRights.wQ = false;
    } else {
      state.castlingRights.bK = false;
      state.castlingRights.bQ = false;
    }
  }

  if (movingPiece.type === 'rook') {
    if (movingPiece.color === 'w') {
      if (from.file === 0 && from.rank === 0) {
        state.castlingRights.wQ = false;
      } else if (from.file === 7 && from.rank === 0) {
        state.castlingRights.wK = false;
      }
    } else {
      if (from.file === 0 && from.rank === 7) {
        state.castlingRights.bQ = false;
      } else if (from.file === 7 && from.rank === 7) {
        state.castlingRights.bK = false;
      }
    }
  }

  if (capturedPiece && capturedPiece.type === 'rook' && capturedSquare) {
    if (capturedPiece.color === 'w') {
      if (capturedSquare.file === 0 && capturedSquare.rank === 0) {
        state.castlingRights.wQ = false;
      } else if (capturedSquare.file === 7 && capturedSquare.rank === 0) {
        state.castlingRights.wK = false;
      }
    } else {
      if (capturedSquare.file === 0 && capturedSquare.rank === 7) {
        state.castlingRights.bQ = false;
      } else if (capturedSquare.file === 7 && capturedSquare.rank === 7) {
        state.castlingRights.bK = false;
      }
    }
  }
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
    lastMove: state.lastMove ? cloneMove(state.lastMove) : null,
    positionCounts: state.positionCounts ? new Map(state.positionCounts) : undefined
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

function opponentColor(color: Color): Color {
  return color === 'w' ? 'b' : 'w';
}

function isInside(file: number, rank: number): boolean {
  return file >= 0 && file < BOARD_SIZE && rank >= 0 && rank < BOARD_SIZE;
}

export function getPositionKey(state: GameState): string {
  let boardKey = '';
  for (let rank = 0; rank < BOARD_SIZE; rank += 1) {
    for (let file = 0; file < BOARD_SIZE; file += 1) {
      const id = state.board[rank][file];
      if (!id) {
        boardKey += '.';
        continue;
      }
      const piece = state.pieces.get(id);
      if (!piece) {
        boardKey += '.';
        continue;
      }
      boardKey += pieceToChar(piece);
    }
  }

  const castling = serializeCastling(state.castlingRights);
  const enPassant = state.enPassantTarget
    ? `${String.fromCharCode(97 + state.enPassantTarget.file)}${state.enPassantTarget.rank + 1}`
    : '-';

  return `${boardKey}|${state.activeColor}|${castling}|${enPassant}`;
}

function pieceToChar(piece: Piece): string {
  const map: Record<PieceType, string> = {
    pawn: 'p',
    knight: 'n',
    bishop: 'b',
    rook: 'r',
    queen: 'q',
    king: 'k'
  };
  const char = map[piece.type] ?? 'p';
  return piece.color === 'w' ? char.toUpperCase() : char;
}

function serializeCastling(rights: CastlingRights): string {
  let value = '';
  if (rights.wK) value += 'K';
  if (rights.wQ) value += 'Q';
  if (rights.bK) value += 'k';
  if (rights.bQ) value += 'q';
  return value || '-';
}

function ensurePositionCount(state: GameState): void {
  if (!state.positionCounts) {
    state.positionCounts = new Map();
  }
  const key = getPositionKey(state);
  if (!state.positionCounts.has(key)) {
    state.positionCounts.set(key, 1);
  }
}

function recordPosition(state: GameState): void {
  if (!state.positionCounts) {
    state.positionCounts = new Map();
  }
  const key = getPositionKey(state);
  const current = state.positionCounts.get(key) ?? 0;
  state.positionCounts.set(key, current + 1);
}

function getPositionCount(state: GameState): number {
  if (!state.positionCounts) {
    return 0;
  }
  const key = getPositionKey(state);
  return state.positionCounts.get(key) ?? 0;
}
