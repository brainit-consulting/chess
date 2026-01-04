import { computeAiMove } from '../../src/ai/aiWorker';
import { AiWorkerRequest } from '../../src/ai/aiWorkerTypes';
import {
  applyMove,
  createInitialState,
  getGameStatus,
  getPieceAt,
  getPositionKey,
  Move
} from '../../src/rules';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

type PlyRecord = {
  color: 'w' | 'b';
  from: { file: number; rank: number };
  to: { file: number; rank: number };
  piece: string;
  uci: string;
};

function moveToUci(move: Move): string {
  const from = `${FILES[move.from.file]}${move.from.rank + 1}`;
  const to = `${FILES[move.to.file]}${move.to.rank + 1}`;
  const promo = move.promotion ? move.promotion[0] : '';
  return `${from}${to}${promo}`;
}

function isBacktrack(a: PlyRecord, b: PlyRecord): boolean {
  return (
    a.from.file === b.to.file &&
    a.from.rank === b.to.rank &&
    a.to.file === b.from.file &&
    a.to.rank === b.from.rank
  );
}

function detectRookShuffle(records: PlyRecord[]): boolean {
  if (records.length < 4) {
    return false;
  }
  const w1 = records[records.length - 4];
  const b1 = records[records.length - 3];
  const w2 = records[records.length - 2];
  const b2 = records[records.length - 1];
  if (w1.color !== 'w' || w2.color !== 'w' || b1.color !== 'b' || b2.color !== 'b') {
    return false;
  }
  if (w1.piece !== 'rook' || w2.piece !== 'rook' || b1.piece !== 'rook' || b2.piece !== 'rook') {
    return false;
  }
  return isBacktrack(w1, w2) && isBacktrack(b1, b2);
}

const plies = Number(process.env.SMOKE_PLIES ?? 12);
const maxTimeMs = Number(process.env.SMOKE_MAX_MS ?? 150);
const maxDepth = Number(process.env.SMOKE_MAX_DEPTH ?? 2);
const seed = Number(process.env.SMOKE_SEED ?? 1);

const state = createInitialState();
const records: PlyRecord[] = [];

for (let ply = 1; ply <= plies; ply += 1) {
  const request: AiWorkerRequest = {
    kind: 'move',
    requestId: ply,
    state,
    color: state.activeColor,
    difficulty: 'max',
    seed,
    playForWin: false,
    maxTimeMs,
    maxDepth,
    nnueMix: 0
  };

  const response = computeAiMove(request);
  if (!response || response.kind !== 'move' || !response.move) {
    console.error('[smoke:ui-max] no move returned', { ply });
    process.exit(1);
  }

  const move = response.move;
  const piece = getPieceAt(state, move.from);
  const record: PlyRecord = {
    color: state.activeColor,
    from: { ...move.from },
    to: { ...move.to },
    piece: piece?.type ?? 'unknown',
    uci: moveToUci(move)
  };
  records.push(record);

  applyMove(state, move);
  const key = getPositionKey(state);
  const count = state.positionCounts?.get(key) ?? 0;
  const totalKeys = state.positionCounts?.size ?? 0;

  console.log(
    `[ply ${ply}] ${record.uci} count=${count} positions=${totalKeys}`
  );

  if (count >= 3) {
    console.error('[smoke:ui-max] reached threefold repetition', {
      ply,
      key,
      count
    });
    process.exit(1);
  }
  if (detectRookShuffle(records)) {
    console.error('[smoke:ui-max] detected rook shuffle loop', {
      sequence: records.slice(-4).map((entry) => entry.uci).join(' ')
    });
    process.exit(1);
  }

  const status = getGameStatus(state);
  if (status.status !== 'ongoing' && status.status !== 'check') {
    break;
  }
}

console.log(`[smoke:ui-max] moves: ${records.map((entry) => entry.uci).join(' ')}`);
