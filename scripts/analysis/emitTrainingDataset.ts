import fs from 'node:fs/promises';
import path from 'node:path';
import {
  Color,
  GameState,
  Move,
  PieceType,
  applyMove,
  getAllLegalMoves,
  getPositionKey
} from '../../src/rules';

type AnnotatedPly = {
  ply: number;
  moveNumber: number;
  color: Color;
  san: string;
  uci: string;
  evalCp?: number;
  mateIn?: number;
  evalCp16?: number;
  mateIn16?: number;
  bestLine?: string;
  bestLine16?: string;
};

type AnnotatedGame = {
  meta: {
    gameId: number;
    startFen: string;
    engineColor: Color;
  };
  plies: AnnotatedPly[];
};

type GameSummary = {
  gameId: number;
  earliestMatePly: number | null;
  firstEvalBelow300: number | null;
  firstEvalBelow500: number | null;
};

type Bucket = 'danger_onset' | 'pre_collapse' | 'collapse' | 'control';

type DatasetRow = {
  runId: string;
  gameId: number;
  ply: number;
  moveNumber: number;
  sideToMove: Color;
  fen: string;
  bucket: Bucket;
  evalCp: number | null;
  mateIn: number | null;
  bestMoveUci: string | null;
  pv: string | null;
  evalCp16: number | null;
  mateIn16: number | null;
  bestMoveUci16: string | null;
  pv16: string | null;
};

const MAX_PV_LENGTH = 4;
const CONTROL_TARGET = 4;

function parseArgs(argv: string[]): { analysisDir: string; outPath: string } {
  const analysisDir = argv[2];
  if (!analysisDir) {
    throw new Error('Usage: emitTrainingDataset <analysisDir> [--out <path>]');
  }
  const outFlag = argv.indexOf('--out');
  const outPath =
    outFlag !== -1 && argv[outFlag + 1]
      ? argv[outFlag + 1]
      : path.join(analysisDir, 'dataset.jsonl');
  return { analysisDir, outPath };
}

function bestMoveFromLine(line?: string): { best: string | null; pv: string | null } {
  if (!line) {
    return { best: null, pv: null };
  }
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return { best: null, pv: null };
  }
  return {
    best: tokens[0],
    pv: tokens.slice(0, MAX_PV_LENGTH).join(' ')
  };
}

function evalForThreshold(ply: AnnotatedPly): number {
  if (ply.mateIn !== undefined) {
    return ply.mateIn > 0 ? 2000 : -2000;
  }
  return ply.evalCp ?? 0;
}

function firstIndex<T>(items: T[], predicate: (item: T) => boolean): number | null {
  for (let i = 0; i < items.length; i += 1) {
    if (predicate(items[i])) {
      return i + 1;
    }
  }
  return null;
}

function collectIndices(indices: number[], max: number): number[] {
  const set = new Set<number>();
  for (const index of indices) {
    if (index >= 1 && index <= max) {
      set.add(index);
    }
  }
  return Array.from(set).sort((a, b) => a - b);
}

async function emitDataset(analysisDir: string, outPath: string): Promise<Record<string, number>> {
  const summaryRaw = await fs.readFile(path.join(analysisDir, 'summary.json'), 'utf8');
  const summary = JSON.parse(summaryRaw) as {
    runId: string;
    gameSummaries: GameSummary[];
  };
  const runId = summary.runId;
  const summaryByGame = new Map<number, GameSummary>();
  for (const game of summary.gameSummaries) {
    summaryByGame.set(game.gameId, game);
  }

  const gameFiles = (await fs.readdir(analysisDir))
    .filter((name) => name.endsWith('-annotated.json'))
    .sort();

  const bucketCounts: Record<Bucket, number> = {
    danger_onset: 0,
    pre_collapse: 0,
    collapse: 0,
    control: 0
  };

  const rows: DatasetRow[] = [];

  for (const file of gameFiles) {
    const raw = await fs.readFile(path.join(analysisDir, file), 'utf8');
    const game = JSON.parse(raw) as AnnotatedGame;
    const plies = game.plies;
    const gameSummary = summaryByGame.get(game.meta.gameId);
    if (!gameSummary) {
      continue;
    }

    const evals = plies.map((ply) => evalForThreshold(ply));
    const firstBelow150 = firstIndex(plies, (ply) => evalForThreshold(ply) <= -150);
    const firstSwing300 = firstIndex(evals.slice(1), (_value, idx) => {
      const delta = Math.abs(evals[idx + 1] - evals[idx]);
      return delta >= 300;
    });
    const swingIndex = firstSwing300 ? firstSwing300 + 1 : null;
    const dangerOnset = [firstBelow150, swingIndex].filter(Boolean) as number[];
    const u = dangerOnset.length > 0 ? Math.min(...dangerOnset) : null;

    const t = gameSummary.firstEvalBelow300;
    const end = gameSummary.earliestMatePly ?? t ?? plies.length;

    const dangerIndices = u ? collectIndices([u - 2, u - 1, u], plies.length) : [];
    const preIndices = t ? collectIndices([t - 2, t - 1], plies.length) : [];
    const collapseIndices = t
      ? collectIndices([t, t + 1, end ? end - 1 : t + 1], plies.length)
      : [];

    const controlIndices: number[] = [];
    if (t && t > 1) {
      for (let i = 1; i < t && controlIndices.length < CONTROL_TARGET; i += 1) {
        const value = evals[i - 1];
        if (Math.abs(value) <= 100) {
          controlIndices.push(i);
        }
      }
    }

    const bucketMap: Array<[Bucket, number[]]> = [
      ['danger_onset', dangerIndices],
      ['pre_collapse', preIndices],
      ['collapse', collapseIndices],
      ['control', controlIndices]
    ];

    for (const [bucket, indices] of bucketMap) {
      for (const plyIndex of indices) {
        const ply = plies[plyIndex - 1];
        if (!ply) {
          continue;
        }
        const { best, pv } = bestMoveFromLine(ply.bestLine);
        const { best: best16, pv: pv16 } = bestMoveFromLine(ply.bestLine16);
        const fen = fenAtPly(game.meta.startFen, plies, plyIndex - 1);
        rows.push({
          runId,
          gameId: game.meta.gameId,
          ply: plyIndex,
          moveNumber: ply.moveNumber,
          sideToMove: ply.color,
          fen,
          bucket,
          evalCp: ply.mateIn !== undefined ? null : ply.evalCp ?? 0,
          mateIn: ply.mateIn ?? null,
          bestMoveUci: best,
          pv,
          evalCp16: ply.mateIn16 !== undefined ? null : ply.evalCp16 ?? null,
          mateIn16: ply.mateIn16 ?? null,
          bestMoveUci16: best16,
          pv16
        });
        bucketCounts[bucket] += 1;
      }
    }
  }

  const lines = rows.map((row) => JSON.stringify(row)).join('\n');
  await fs.writeFile(outPath, `${lines}\n`, 'utf8');
  return bucketCounts;
}

function fenAtPly(startFen: string, plies: AnnotatedPly[], plyIndex: number): string {
  const state = createStateFromFen(startFen);
  for (let i = 0; i < plyIndex; i += 1) {
    const move = uciToMove(state, plies[i].uci);
    if (!move) {
      throw new Error(`Failed to resolve UCI ${plies[i].uci} at ply ${i + 1}`);
    }
    applyMove(state, move);
  }
  return stateToFen(state);
}

function uciToMove(state: GameState, uci: string): Move | null {
  if (!uci || uci.length < 4) {
    return null;
  }
  const from = algebraicToSquare(uci.slice(0, 2));
  const to = algebraicToSquare(uci.slice(2, 4));
  const promotion = uci.length > 4 ? uci[4] : undefined;
  if (!from || !to) {
    return null;
  }
  const legalMoves = getAllLegalMoves(state, state.activeColor);
  return (
    legalMoves.find((move) => {
      if (move.from.file !== from.file || move.from.rank !== from.rank) return false;
      if (move.to.file !== to.file || move.to.rank !== to.rank) return false;
      if (promotion) {
        return move.promotion && move.promotion.startsWith(promotion);
      }
      return !move.promotion;
    }) ?? null
  );
}

function createStateFromFen(fen: string): GameState {
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 4) {
    throw new Error(`Invalid FEN: ${fen}`);
  }
  const [boardPart, activeColorRaw, castlingRaw, enPassantRaw, halfmoveRaw, fullmoveRaw] = parts;
  const board = Array.from({ length: 8 }, () => Array(8).fill(null)) as (number | null)[][];
  const pieces = new Map<number, { id: number; type: PieceType; color: Color; hasMoved: boolean }>();
  let nextId = 1;
  const ranks = boardPart.split('/');
  if (ranks.length !== 8) {
    throw new Error(`Invalid FEN board: ${fen}`);
  }
  for (let fenRank = 0; fenRank < 8; fenRank += 1) {
    const rank = 7 - fenRank;
    let file = 0;
    for (const char of ranks[fenRank]) {
      if (char >= '1' && char <= '8') {
        file += Number(char);
        continue;
      }
      const piece = fenCharToPiece(char);
      if (!piece) {
        throw new Error(`Invalid FEN piece: ${fen}`);
      }
      pieces.set(nextId, { id: nextId, ...piece, hasMoved: false });
      board[rank][file] = nextId;
      nextId += 1;
      file += 1;
    }
    if (file !== 8) {
      throw new Error(`Invalid FEN rank width: ${fen}`);
    }
  }

  const activeColor = activeColorRaw === 'b' ? 'b' : 'w';
  const castlingRights = {
    wK: castlingRaw.includes('K'),
    wQ: castlingRaw.includes('Q'),
    bK: castlingRaw.includes('k'),
    bQ: castlingRaw.includes('q')
  };
  const enPassantTarget = enPassantRaw && enPassantRaw !== '-' ? algebraicToSquare(enPassantRaw) : null;
  const halfmoveClock = Number(halfmoveRaw ?? 0) || 0;
  const fullmoveNumber = Number(fullmoveRaw ?? 1) || 1;
  const state: GameState = {
    board,
    pieces,
    activeColor,
    castlingRights,
    enPassantTarget: enPassantTarget ? { file: enPassantTarget.file, rank: enPassantTarget.rank } : null,
    halfmoveClock,
    fullmoveNumber,
    lastMove: null,
    positionCounts: new Map()
  };
  state.positionCounts?.set(getPositionKey(state), 1);
  return state;
}

function fenCharToPiece(char: string): { type: PieceType; color: Color } | null {
  const lower = char.toLowerCase();
  const type =
    lower === 'p'
      ? 'pawn'
      : lower === 'n'
      ? 'knight'
      : lower === 'b'
      ? 'bishop'
      : lower === 'r'
      ? 'rook'
      : lower === 'q'
      ? 'queen'
      : lower === 'k'
      ? 'king'
      : null;
  if (!type) {
    return null;
  }
  return { type, color: char === lower ? 'b' : 'w' };
}

function algebraicToSquare(text: string): { file: number; rank: number } | null {
  if (text.length !== 2) {
    return null;
  }
  const file = text.charCodeAt(0) - 97;
  const rank = Number(text[1]) - 1;
  if (file < 0 || file > 7 || rank < 0 || rank > 7) {
    return null;
  }
  return { file, rank };
}

function stateToFen(state: GameState): string {
  let board = '';
  for (let rank = 7; rank >= 0; rank -= 1) {
    let empty = 0;
    for (let file = 0; file < 8; file += 1) {
      const id = state.board[rank][file];
      if (!id) {
        empty += 1;
        continue;
      }
      if (empty > 0) {
        board += empty.toString();
        empty = 0;
      }
      const piece = state.pieces.get(id);
      board += piece ? pieceToChar(piece.type, piece.color) : '1';
    }
    if (empty > 0) {
      board += empty.toString();
    }
    if (rank > 0) {
      board += '/';
    }
  }
  const castling = serializeCastling(state);
  const enPassant = state.enPassantTarget
    ? `${String.fromCharCode(97 + state.enPassantTarget.file)}${state.enPassantTarget.rank + 1}`
    : '-';
  return `${board} ${state.activeColor} ${castling} ${enPassant} ${state.halfmoveClock} ${state.fullmoveNumber}`;
}

function pieceToChar(type: PieceType, color: Color): string {
  const map: Record<PieceType, string> = {
    pawn: 'p',
    knight: 'n',
    bishop: 'b',
    rook: 'r',
    queen: 'q',
    king: 'k'
  };
  const char = map[type] ?? 'p';
  return color === 'w' ? char.toUpperCase() : char;
}

function serializeCastling(state: GameState): string {
  let value = '';
  if (state.castlingRights.wK) value += 'K';
  if (state.castlingRights.wQ) value += 'Q';
  if (state.castlingRights.bK) value += 'k';
  if (state.castlingRights.bQ) value += 'q';
  return value || '-';
}

async function main() {
  const { analysisDir, outPath } = parseArgs(process.argv);
  const counts = await emitDataset(analysisDir, outPath);
  const summaryPath = `${outPath}.summary.json`;
  await fs.writeFile(summaryPath, JSON.stringify({ buckets: counts }, null, 2), 'utf8');
  console.log('Bucket counts:', counts);
  console.log('Dataset:', outPath);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
