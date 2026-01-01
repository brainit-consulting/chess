import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import readline from 'node:readline';
import { buildSan } from '../../src/pgn/pgn';
import {
  Color,
  GameState,
  Move,
  PieceType,
  Square,
  addPiece,
  applyMove,
  createEmptyState,
  getAllLegalMoves,
  getPieceAt,
  getPositionKey,
  isInCheck
} from '../../src/rules';

type StockfishConfig = {
  path: string;
  threads?: number;
  hashMb?: number;
  ponder?: boolean;
};

type AnalysisInfo = {
  depth: number;
  evalCp?: number;
  mateIn?: number;
  pv: string[];
};

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
  material: {
    w: Record<string, number>;
    b: Record<string, number>;
    diffCp: number;
  };
};

type MotifTag = {
  gameId: number;
  ply: number;
  tag: 'king_safety' | 'hanging_piece' | 'missed_defense';
  reason: string;
};

type GameSummary = {
  gameId: number;
  earliestMatePly: number | null;
  firstEvalBelow300: number | null;
  firstEvalBelow500: number | null;
  swingCounts: Record<string, number>;
  collapseWindow?: {
    startPly: number;
    endPly: number;
    pv: string;
  };
};

const RESULT_TOKENS = new Set(['1-0', '0-1', '1/2-1/2', '*']);
const DEFAULT_DEPTH = 12;
const DEFAULT_DEPTH16 = 16;
const SWING_THRESHOLDS = [150, 300, 500];
const MATE_SCORE = 20000;
const PV_MAX_LENGTH = 8;

class StockfishAnalyzer {
  private proc: ReturnType<typeof spawn>;
  private rl: readline.Interface;
  private pending: {
    targetDepth: number;
    resolve: (value: AnalysisInfo | null) => void;
    reject: (error: Error) => void;
    best: AnalysisInfo | null;
  } | null = null;

  constructor(private config: StockfishConfig) {
    this.proc = spawn(this.config.path, [], { stdio: 'pipe' });
    this.rl = readline.createInterface({ input: this.proc.stdout });
    this.proc.on('error', (error) => this.reject(error));
    this.proc.on('exit', () => this.reject(new Error('Stockfish process exited')));
    this.rl.on('line', (line) => this.handleLine(line));
  }

  async init(): Promise<void> {
    await this.sendAndWait('uci', 'uciok');
    this.send(`setoption name Threads value ${this.config.threads ?? 1}`);
    this.send(`setoption name Hash value ${this.config.hashMb ?? 64}`);
    this.send(`setoption name Ponder value ${this.config.ponder ? 'true' : 'false'}`);
    await this.sendAndWait('isready', 'readyok');
  }

  async analyze(fen: string, depth: number): Promise<AnalysisInfo | null> {
    await this.sendAndWait('isready', 'readyok');
    this.send(`position fen ${fen}`);
    this.send(`go depth ${depth}`);
    return new Promise((resolve, reject) => {
      this.pending = { targetDepth: depth, resolve, reject, best: null };
    });
  }

  quit(): void {
    this.send('quit');
    this.rl.close();
    this.proc.kill();
  }

  private handleLine(line: string): void {
    if (!this.pending) {
      return;
    }
    if (line.startsWith('bestmove')) {
      const resolved = this.pending.best;
      this.pending.resolve(resolved);
      this.pending = null;
      return;
    }
    if (!line.startsWith('info')) {
      return;
    }
    const depthMatch = line.match(/ depth (\d+)/);
    const scoreMatch = line.match(/ score (cp|mate) (-?\d+)/);
    if (!depthMatch || !scoreMatch) {
      return;
    }
    const depth = Number(depthMatch[1]);
    if (depth > this.pending.targetDepth) {
      return;
    }
    const scoreType = scoreMatch[1];
    const scoreValue = Number(scoreMatch[2]);
    const pvMatch = line.match(/ pv (.+)$/);
    const pv = pvMatch ? pvMatch[1].trim().split(/\s+/).slice(0, PV_MAX_LENGTH) : [];
    const info: AnalysisInfo = {
      depth,
      pv,
      evalCp: scoreType === 'cp' ? scoreValue : undefined,
      mateIn: scoreType === 'mate' ? scoreValue : undefined
    };
    const best = this.pending.best;
    if (!best || depth > best.depth) {
      this.pending.best = info;
    } else if (depth === best.depth && pv.length > 0) {
      this.pending.best = info;
    }
  }

  private async sendAndWait(command: string, expected: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const onLine = (line: string) => {
        if (line.startsWith(expected)) {
          cleanup();
          resolve();
        }
      };
      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };
      const onExit = () => {
        cleanup();
        reject(new Error('Stockfish process exited'));
      };
      const cleanup = () => {
        this.rl.off('line', onLine);
        this.proc.off('error', onError);
        this.proc.off('exit', onExit);
      };
      this.rl.on('line', onLine);
      this.proc.on('error', onError);
      this.proc.on('exit', onExit);
      this.send(command);
    });
  }

  private send(command: string): void {
    this.proc.stdin.write(`${command}\n`);
  }

  private reject(error: Error): void {
    if (this.pending) {
      this.pending.reject(error);
      this.pending = null;
    }
  }
}

type AnnotateOptions = {
  runDir: string;
  depth: number;
  depth16: number;
  start: number | null;
  count: number | null;
};

function parseArgs(argv: string[]): AnnotateOptions {
  const runDir = argv[2];
  if (!runDir) {
    throw new Error(
      'Usage: annotateStockfish <runDir> [--depth 12] [--depth16 16] [--start 1] [--count 20]'
    );
  }
  const depth = Number(getArg(argv, '--depth', DEFAULT_DEPTH));
  const depth16 = Number(getArg(argv, '--depth16', DEFAULT_DEPTH16));
  const start = getOptionalInt(argv, '--start');
  const count = getOptionalInt(argv, '--count');
  return { runDir, depth, depth16, start, count };
}

function getArg(argv: string[], name: string, fallback: number): number {
  const index = argv.indexOf(name);
  if (index === -1 || index + 1 >= argv.length) {
    return fallback;
  }
  const value = Number(argv[index + 1]);
  return Number.isFinite(value) ? value : fallback;
}

function getOptionalInt(argv: string[], name: string): number | null {
  const index = argv.indexOf(name);
  if (index === -1 || index + 1 >= argv.length) {
    return null;
  }
  const value = Number(argv[index + 1]);
  return Number.isFinite(value) ? value : null;
}

function parsePgnMoves(pgn: string): string[] {
  const split = pgn.split(/\r?\n\r?\n/);
  const movesText = split.slice(1).join(' ').trim();
  const cleaned = movesText
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/;[^\n]*/g, ' ')
    .replace(/\$[0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const tokens = cleaned.split(/\s+/);
  const moves: string[] = [];
  for (const token of tokens) {
    if (!token) {
      continue;
    }
    if (RESULT_TOKENS.has(token)) {
      continue;
    }
    if (/^\d+\.+$/.test(token)) {
      continue;
    }
    let san = token.replace(/[!?]+$/g, '');
    if (san === '0-0') san = 'O-O';
    if (san === '0-0-0') san = 'O-O-O';
    moves.push(san);
  }
  return moves;
}

function moveToUci(move: Move): string {
  const from = `${String.fromCharCode(97 + move.from.file)}${move.from.rank + 1}`;
  const to = `${String.fromCharCode(97 + move.to.file)}${move.to.rank + 1}`;
  const promo = move.promotion ? move.promotion[0] : '';
  return `${from}${to}${promo}`;
}

function findMoveBySan(state: GameState, san: string): Move | null {
  const legalMoves = getAllLegalMoves(state, state.activeColor);
  const normalized = normalizeSan(san);
  const matches = legalMoves.filter(
    (move) => normalizeSan(buildSan(state, move)) === normalized
  );
  if (matches.length > 0) {
    return matches[0];
  }
  const stripped = normalized.replace(/[+#]$/g, '');
  const loose = legalMoves.filter(
    (move) => normalizeSan(buildSan(state, move)).replace(/[+#]$/g, '') === stripped
  );
  return loose[0] ?? null;
}

function normalizeSan(value: string): string {
  return value.trim();
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

function materialSnapshot(state: GameState): { w: Record<string, number>; b: Record<string, number>; diffCp: number } {
  const counts = {
    w: { pawn: 0, knight: 0, bishop: 0, rook: 0, queen: 0 },
    b: { pawn: 0, knight: 0, bishop: 0, rook: 0, queen: 0 }
  };
  for (const piece of state.pieces.values()) {
    if (piece.type === 'king') {
      continue;
    }
    counts[piece.color][piece.type] += 1;
  }
  const values: Record<string, number> = {
    pawn: 100,
    knight: 320,
    bishop: 330,
    rook: 500,
    queen: 900
  };
  const material =
    counts.w.pawn * values.pawn +
    counts.w.knight * values.knight +
    counts.w.bishop * values.bishop +
    counts.w.rook * values.rook +
    counts.w.queen * values.queen -
    (counts.b.pawn * values.pawn +
      counts.b.knight * values.knight +
      counts.b.bishop * values.bishop +
      counts.b.rook * values.rook +
      counts.b.queen * values.queen);
  return { w: counts.w, b: counts.b, diffCp: material };
}

function evalToScorpion(
  evalCp: number | undefined,
  mateIn: number | undefined,
  sideToMove: Color,
  engineColor: Color
): { evalCp?: number; mateIn?: number; normalized: number } {
  if (mateIn !== undefined) {
    const sideScore = mateIn;
    const whiteScore = sideToMove === 'w' ? sideScore : -sideScore;
    const scorpionScore = engineColor === 'w' ? whiteScore : -whiteScore;
    return { mateIn: scorpionScore, normalized: scorpionScore * MATE_SCORE };
  }
  const sideScore = evalCp ?? 0;
  const whiteScore = sideToMove === 'w' ? sideScore : -sideScore;
  const scorpionScore = engineColor === 'w' ? whiteScore : -whiteScore;
  return { evalCp: scorpionScore, normalized: scorpionScore };
}

function normalizedEval(ply: Pick<AnnotatedPly, 'evalCp' | 'mateIn'>): number {
  if (ply.mateIn !== undefined) {
    return ply.mateIn * MATE_SCORE;
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

function pvStartsWithCheck(state: GameState, pv: string[]): boolean {
  if (pv.length === 0) {
    return false;
  }
  const move = uciToMove(state, pv[0]);
  if (!move) {
    return false;
  }
  const next = cloneState(state);
  applyMove(next, move);
  return isInCheck(next, opponentColor(state.activeColor));
}

function uciToMove(state: GameState, uci: string): Move | null {
  if (uci.length < 4) {
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

function cloneState(state: GameState): GameState {
  const board = state.board.map((row) => row.slice());
  const pieces = new Map<number, ReturnType<typeof getPieceAt>>();
  for (const [id, piece] of state.pieces) {
    pieces.set(id, { ...piece });
  }
  return {
    board,
    pieces: pieces as Map<number, any>,
    activeColor: state.activeColor,
    castlingRights: { ...state.castlingRights },
    enPassantTarget: state.enPassantTarget ? { ...state.enPassantTarget } : null,
    halfmoveClock: state.halfmoveClock,
    fullmoveNumber: state.fullmoveNumber,
    lastMove: state.lastMove ? { ...state.lastMove } : null,
    positionCounts: state.positionCounts ? new Map(state.positionCounts) : new Map()
  };
}

function opponentColor(color: Color): Color {
  return color === 'w' ? 'b' : 'w';
}

export async function annotateRun(options: AnnotateOptions): Promise<void> {
  const { runDir, depth, depth16, start, count } = options;
  const summaryPath = path.join(runDir, 'summary.json');
  const summaryRaw = await fs.readFile(summaryPath, 'utf8');
  const summary = JSON.parse(summaryRaw);
  const stockfishPath: string = summary.config?.stockfishPath;
  if (!stockfishPath) {
    throw new Error('Stockfish path missing from summary.json.');
  }
  const runId = path.basename(runDir).replace(/^run-/, '');
  const outputDir = path.join('analysis', runId);
  await fs.mkdir(outputDir, { recursive: true });

  const metaFiles = (await fs.readdir(runDir))
    .filter((name) => name.endsWith('-meta.json'))
    .sort();
  const startIndex = start ? Math.max(0, start - 1) : 0;
  const endIndex = count ? startIndex + count : metaFiles.length;
  const chunkFiles = metaFiles.slice(startIndex, endIndex);

  const gameSummaries: GameSummary[] = [];
  const motifTags: MotifTag[] = [];
  const perGameMate: number[] = [];
  const perGameEval300: number[] = [];
  const perGameEval500: number[] = [];
  const swingTotals: Record<string, number> = { '150': 0, '300': 0, '500': 0 };

  for (const metaFile of chunkFiles) {
    const meta = JSON.parse(await fs.readFile(path.join(runDir, metaFile), 'utf8'));
    const pgnFile = metaFile.replace('-meta.json', '.pgn');
    const pgnText = await fs.readFile(path.join(runDir, pgnFile), 'utf8');
    const moves = parsePgnMoves(pgnText);
    const startFen = meta.startFen;
    if (!startFen) {
      throw new Error(`Missing startFen for ${metaFile}`);
    }
    const engineColor = meta.engineColor as Color;
    let state = createStateFromFen(startFen);

    const plies: AnnotatedPly[] = [];
    const moveObjects: Move[] = [];
    for (let i = 0; i < moves.length; i += 1) {
      const san = moves[i];
      const move = findMoveBySan(state, san);
      if (!move) {
        throw new Error(`Failed to match SAN ${san} in ${metaFile}`);
      }
      const material = materialSnapshot(state);
      const uci = moveToUci(move);
      plies.push({
        ply: i + 1,
        moveNumber: state.fullmoveNumber,
        color: state.activeColor,
        san,
        uci,
        material
      });
      moveObjects.push(move);
      applyMove(state, move);
    }

    const analyzer = new StockfishAnalyzer({
      path: stockfishPath,
      threads: summary.config?.threads ?? 1,
      hashMb: summary.config?.hashMb ?? 64,
      ponder: summary.config?.ponder ?? false
    });
    await analyzer.init();
    try {
      for (let i = 0; i < plies.length; i += 1) {
        const fen = buildFenFromPly(startFen, plies, moveObjects, i);
        const info = await analyzer.analyze(fen, depth);
        const converted = evalToScorpion(info?.evalCp, info?.mateIn, plies[i].color, engineColor);
        plies[i].evalCp = converted.evalCp;
        plies[i].mateIn = converted.mateIn;
        plies[i].bestLine = info?.pv?.join(' ') ?? '';
      }

      const evalNormalized = plies.map(normalizedEval);

    const swingPlies = new Set<number>();
    const swingCounts: Record<string, number> = { '150': 0, '300': 0, '500': 0 };
    for (let i = 1; i < evalNormalized.length; i += 1) {
      const delta = Math.abs(evalNormalized[i] - evalNormalized[i - 1]);
      for (const threshold of SWING_THRESHOLDS) {
        if (delta >= threshold) {
          swingCounts[String(threshold)] += 1;
        }
      }
      if (delta >= 300) {
        for (let offset = -2; offset <= 2; offset += 1) {
          const target = i + offset + 1;
          if (target >= 1 && target <= plies.length) {
            swingPlies.add(target);
          }
        }
      }
    }

      if (swingPlies.size > 0) {
        for (const plyIndex of swingPlies) {
          const fen = buildFenFromPly(startFen, plies, moveObjects, plyIndex - 1);
          const info16 = await analyzer.analyze(fen, depth16);
          if (!info16) {
            continue;
          }
          const converted = evalToScorpion(
            info16.evalCp,
            info16.mateIn,
            plies[plyIndex - 1].color,
            engineColor
          );
          plies[plyIndex - 1].evalCp16 = converted.evalCp;
          plies[plyIndex - 1].mateIn16 = converted.mateIn;
          plies[plyIndex - 1].bestLine16 = info16.pv?.join(' ') ?? '';
        }
      }

    const earliestMate = firstIndex(plies, (ply) => ply.mateIn !== undefined);
    const firstBelow300 = firstIndex(plies, (ply) => (ply.evalCp ?? 0) <= -300 || (ply.mateIn ?? 0) < 0);
    const firstBelow500 = firstIndex(plies, (ply) => (ply.evalCp ?? 0) <= -500 || (ply.mateIn ?? 0) < 0);

    if (earliestMate) {
      perGameMate.push(earliestMate);
    }
    if (firstBelow300) {
      perGameEval300.push(firstBelow300);
    }
    if (firstBelow500) {
      perGameEval500.push(firstBelow500);
    }

    for (const threshold of SWING_THRESHOLDS) {
      swingTotals[String(threshold)] += swingCounts[String(threshold)] ?? 0;
    }

    const collapseWindow =
      firstBelow300 && earliestMate
        ? {
            startPly: firstBelow300,
            endPly: earliestMate,
            pv: plies[firstBelow300 - 1]?.bestLine ?? ''
          }
        : undefined;

    // Motif tags
    for (let i = 1; i < plies.length; i += 1) {
      const delta = Math.abs(evalNormalized[i] - evalNormalized[i - 1]);
      if (delta < 300) {
        continue;
      }
      const ply = plies[i];
      const plyState = buildStateFromPly(startFen, plies, moveObjects, i - 1);
      if (ply.mateIn !== undefined || pvStartsWithCheck(plyState, (plies[i].bestLine ?? '').split(' '))) {
        motifTags.push({
          gameId: meta.gameId,
          ply: ply.ply,
          tag: 'king_safety',
          reason: ply.mateIn !== undefined ? 'mate detected' : 'PV starts with check'
        });
      }
      const materialDelta = plies[i].material.diffCp - plies[i - 1].material.diffCp;
      const scorpionMaterialDelta = engineColor === 'w' ? materialDelta : -materialDelta;
      if (scorpionMaterialDelta <= -300) {
        motifTags.push({
          gameId: meta.gameId,
          ply: ply.ply,
          tag: 'hanging_piece',
          reason: `material drop ${scorpionMaterialDelta}cp`
        });
      }
      const prevMove = moveObjects[i - 1];
      if (prevMove && (prevMove.capturedId || prevMove.isEnPassant || isInCheck(plyState, plyState.activeColor))) {
        motifTags.push({
          gameId: meta.gameId,
          ply: ply.ply,
          tag: 'missed_defense',
          reason: 'swing after forcing move'
        });
      }
    }

    const gameSummary: GameSummary = {
      gameId: meta.gameId,
      earliestMatePly: earliestMate,
      firstEvalBelow300: firstBelow300,
      firstEvalBelow500: firstBelow500,
      swingCounts,
      collapseWindow
    };
    gameSummaries.push(gameSummary);

      const outFile = path.join(
        outputDir,
        `game-${String(meta.gameId).padStart(4, '0')}-annotated.json`
      );
      await fs.writeFile(outFile, JSON.stringify({ meta, plies }, null, 2), 'utf8');
      plies.length = 0;
      moveObjects.length = 0;
    } finally {
      analyzer.quit();
    }
  }

  const motifCounts = motifTags.reduce(
    (acc, tag) => {
      acc[tag.tag] += 1;
      return acc;
    },
    { king_safety: 0, hanging_piece: 0, missed_defense: 0 }
  );

  const summaryOut = {
    runId,
    sourceRunDir: runDir,
    depth,
    depth16,
    analyzedAt: new Date().toISOString(),
    gameCount: gameSummaries.length,
    earliestMatePly: perGameMate,
    firstEvalBelow300: perGameEval300,
    firstEvalBelow500: perGameEval500,
    swingTotals,
    motifs: {
      counts: motifCounts,
      tags: motifTags
    },
    gameSummaries
  };

  await fs.writeFile(path.join(outputDir, 'summary.json'), JSON.stringify(summaryOut, null, 2), 'utf8');
}

function buildFenFromPly(
  startFen: string,
  plies: AnnotatedPly[],
  moves: Move[],
  plyIndex: number
): string {
  const state = buildStateFromPly(startFen, plies, moves, plyIndex);
  return stateToFen(state);
}

function buildStateFromPly(
  startFen: string,
  plies: AnnotatedPly[],
  moves: Move[],
  plyIndex: number
): GameState {
  const state = createStateFromFen(startFen);
  for (let i = 0; i < plyIndex; i += 1) {
    applyMove(state, moves[i]);
  }
  return state;
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
  const options = parseArgs(process.argv);
  await annotateRun(options);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
