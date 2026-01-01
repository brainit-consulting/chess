import { Color, GameState, Move, NnueState, PieceType, Square } from '../../rules';

export type NnueWeights = {
  inputSize: number;
  hiddenSize: number;
  version: number;
  flags: number;
  w1: Float32Array;
  b1: Float32Array;
  w2: Float32Array;
  b2: number;
};

const MAGIC = 'SNN1';
const DEFAULT_INPUT_SIZE = 768;
const DEFAULT_HIDDEN_SIZE = 64;
const RELU_CAP = 127;
const PIECE_TYPE_INDEX: Record<PieceType, number> = {
  pawn: 0,
  knight: 1,
  bishop: 2,
  rook: 3,
  queen: 4,
  king: 5
};

let activeWeights: NnueWeights | null = null;

export function parseNnueWeights(buffer: ArrayBuffer): NnueWeights {
  if (buffer.byteLength < 12) {
    throw new Error('NNUE weights buffer is too small.');
  }
  const header = new Uint8Array(buffer, 0, 4);
  const magic = String.fromCharCode(...header);
  if (magic !== MAGIC) {
    throw new Error(`NNUE weights magic mismatch: ${magic}`);
  }

  const view = new DataView(buffer, 4);
  const inputSize = view.getUint16(0, true);
  const hiddenSize = view.getUint16(2, true);
  const version = view.getUint16(4, true);
  const flags = view.getUint16(6, true);

  const floatOffset = 12;
  const floatCount = inputSize * hiddenSize + hiddenSize + hiddenSize + 1;
  const expectedLength = floatOffset + floatCount * 4;
  if (buffer.byteLength < expectedLength) {
    throw new Error('NNUE weights buffer is truncated.');
  }

  const floatView = new Float32Array(buffer, floatOffset, floatCount);
  let offset = 0;
  const w1 = floatView.slice(offset, offset + inputSize * hiddenSize);
  offset += inputSize * hiddenSize;
  const b1 = floatView.slice(offset, offset + hiddenSize);
  offset += hiddenSize;
  const w2 = floatView.slice(offset, offset + hiddenSize);
  offset += hiddenSize;
  const b2 = floatView[offset] ?? 0;

  return { inputSize, hiddenSize, version, flags, w1, b1, w2, b2 };
}

export function createZeroWeights(
  inputSize = DEFAULT_INPUT_SIZE,
  hiddenSize = DEFAULT_HIDDEN_SIZE
): NnueWeights {
  return {
    inputSize,
    hiddenSize,
    version: 1,
    flags: 0,
    w1: new Float32Array(inputSize * hiddenSize),
    b1: new Float32Array(hiddenSize),
    w2: new Float32Array(hiddenSize),
    b2: 0
  };
}

export function setNnueWeights(weights: NnueWeights | null): void {
  activeWeights = weights;
}

export function getNnueWeights(): NnueWeights | null {
  return activeWeights;
}

export function getOrCreateDefaultWeights(): NnueWeights {
  if (!activeWeights) {
    activeWeights = createZeroWeights();
  }
  return activeWeights;
}

export function buildAccumulator(state: GameState, weights: NnueWeights): NnueState {
  const data = new Float32Array(weights.b1);
  for (const piece of state.pieces.values()) {
    const square = findPieceSquare(state, piece.id);
    if (!square) {
      continue;
    }
    addFeature(data, weights, piece.type, piece.color, square, 1);
  }
  return { inputSize: weights.inputSize, hiddenSize: weights.hiddenSize, accumulator: data };
}

export function ensureAccumulator(state: GameState, weights: NnueWeights): NnueState {
  if (!state.nnue) {
    state.nnue = buildAccumulator(state, weights);
    return state.nnue;
  }
  if (state.nnue.inputSize !== weights.inputSize || state.nnue.hiddenSize !== weights.hiddenSize) {
    state.nnue = buildAccumulator(state, weights);
  }
  return state.nnue;
}

export function updateAccumulatorForMove(
  acc: NnueState,
  state: GameState,
  move: Move,
  weights: NnueWeights
): NnueState {
  const data = new Float32Array(acc.accumulator);
  const movingId = state.board[move.from.rank]?.[move.from.file];
  if (!movingId) {
    return acc;
  }
  const movingPiece = state.pieces.get(movingId);
  if (!movingPiece) {
    return acc;
  }

  addFeature(data, weights, movingPiece.type, movingPiece.color, move.from, -1);

  if (move.isEnPassant) {
    const dir = movingPiece.color === 'w' ? 1 : -1;
    const capturedSquare = { file: move.to.file, rank: move.to.rank - dir };
    const capturedId = state.board[capturedSquare.rank]?.[capturedSquare.file];
    if (capturedId) {
      const captured = state.pieces.get(capturedId);
      if (captured) {
        addFeature(data, weights, captured.type, captured.color, capturedSquare, -1);
      }
    }
  } else {
    const capturedId = state.board[move.to.rank]?.[move.to.file];
    if (capturedId) {
      const captured = state.pieces.get(capturedId);
      if (captured) {
        addFeature(data, weights, captured.type, captured.color, move.to, -1);
      }
    }
  }

  if (move.isCastle) {
    const rookFromFile = move.to.file === 6 ? 7 : 0;
    const rookToFile = move.to.file === 6 ? 5 : 3;
    const rookFrom = { file: rookFromFile, rank: move.from.rank };
    const rookTo = { file: rookToFile, rank: move.from.rank };
    const rookId = state.board[rookFrom.rank]?.[rookFrom.file];
    if (rookId) {
      const rook = state.pieces.get(rookId);
      if (rook) {
        addFeature(data, weights, rook.type, rook.color, rookFrom, -1);
        addFeature(data, weights, rook.type, rook.color, rookTo, 1);
      }
    }
  }

  const destType = move.promotion ?? movingPiece.type;
  addFeature(data, weights, destType, movingPiece.color, move.to, 1);

  return {
    inputSize: acc.inputSize,
    hiddenSize: acc.hiddenSize,
    accumulator: data
  };
}

export function evaluateFromAccumulator(acc: NnueState, weights: NnueWeights): number {
  let output = weights.b2;
  for (let i = 0; i < weights.hiddenSize; i += 1) {
    let value = acc.accumulator[i] ?? 0;
    if (value <= 0) {
      continue;
    }
    if (value > RELU_CAP) {
      value = RELU_CAP;
    }
    output += value * weights.w2[i];
  }
  return output;
}

export function evaluateNnue(state: GameState, weights: NnueWeights): number {
  const acc = ensureAccumulator(state, weights);
  return evaluateFromAccumulator(acc, weights);
}

function addFeature(
  data: Float32Array,
  weights: NnueWeights,
  type: PieceType,
  color: Color,
  square: Square,
  direction: number
): void {
  const featureIndex = getFeatureIndex(type, color, square);
  const offset = featureIndex * weights.hiddenSize;
  for (let i = 0; i < weights.hiddenSize; i += 1) {
    data[i] += weights.w1[offset + i] * direction;
  }
}

function getFeatureIndex(type: PieceType, color: Color, square: Square): number {
  const colorOffset = color === 'w' ? 0 : 6;
  const typeIndex = PIECE_TYPE_INDEX[type] ?? 0;
  const squareIndex =
    (color === 'w' ? square.rank : 7 - square.rank) * 8 + square.file;
  return (colorOffset + typeIndex) * 64 + squareIndex;
}

function findPieceSquare(state: GameState, id: number): Square | null {
  for (let rank = 0; rank < 8; rank += 1) {
    for (let file = 0; file < 8; file += 1) {
      if (state.board[rank]?.[file] === id) {
        return { file, rank };
      }
    }
  }
  return null;
}
