import { describe, expect, it } from 'vitest';
import { chooseMove } from '../ai';
import { explainMove } from '../aiExplain';
import { computeAiMove } from '../aiWorker';
import { evaluateState } from '../evaluate';
import {
  shouldApplyAiResponse,
  shouldApplyExplainResponse,
  shouldApplyHintResponse,
  shouldPauseForExplanation,
  shouldRequestHint,
  shouldResumeAfterExplanation,
  selectWorkerForRequest
} from '../aiWorkerClient';
import * as search from '../search';
import {
  addPiece,
  applyMove,
  createEmptyState,
  createInitialState,
  getAllLegalMoves,
  getLegalMovesForSquare,
  getPositionKey,
  GameState,
  Piece,
  Square,
  Move
} from '../../rules';

const sq = (file: number, rank: number): Square => ({ file, rank });

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

function createSequenceRng(values: number[]): () => number {
  let index = 0;
  return () => {
    const value = values[Math.min(index, values.length - 1)] ?? 0;
    index += 1;
    return value;
  };
}

describe('AI move selection', () => {
  it('never selects an illegal move', () => {
    const state = createEmptyState();
    addPiece(state, 'king', 'w', sq(4, 0));
    addPiece(state, 'king', 'b', sq(4, 7));
    addPiece(state, 'rook', 'b', sq(0, 7));
    state.activeColor = 'b';

    const move = chooseMove(state, { difficulty: 'easy', seed: 42 });
    expect(move).not.toBeNull();
    if (!move) {
      throw new Error('Expected AI to return a move.');
    }

    const legalMoves = getAllLegalMoves(state, 'b');
    expect(legalMoves.some((candidate) => sameMove(candidate, move))).toBe(true);
  });

  it('responds with a move when legal moves exist', () => {
    const state = createInitialState();
    state.activeColor = 'b';

    const move = chooseMove(state, { difficulty: 'easy', seed: 7 });
    expect(move).not.toBeNull();
  });

  it('returns no move when checkmated or stalemated', () => {
    const checkmate = createEmptyState();
    addPiece(checkmate, 'king', 'b', sq(7, 7));
    addPiece(checkmate, 'king', 'w', sq(5, 5));
    addPiece(checkmate, 'queen', 'w', sq(6, 6));
    checkmate.activeColor = 'b';

    const mateMove = chooseMove(checkmate, { difficulty: 'easy', seed: 1 });
    expect(mateMove).toBeNull();

    const stalemate = createEmptyState();
    addPiece(stalemate, 'king', 'b', sq(7, 7));
    addPiece(stalemate, 'king', 'w', sq(5, 6));
    addPiece(stalemate, 'queen', 'w', sq(6, 5));
    stalemate.activeColor = 'b';

    const staleMove = chooseMove(stalemate, { difficulty: 'easy', seed: 1 });
    expect(staleMove).toBeNull();
  });

  it('matches worker move selection for the same position', () => {
    const state = createInitialState();
    state.activeColor = 'b';

    const direct = chooseMove(state, { difficulty: 'medium', seed: 99 });
    const worker = computeAiMove({
      kind: 'move',
      requestId: 1,
      state,
      color: 'b',
      difficulty: 'medium',
      seed: 99
    });

    expect(direct).not.toBeNull();
    if (!worker || worker.kind !== 'move') {
      throw new Error('Expected worker response.');
    }
    expect(worker.move).not.toBeNull();
    if (!direct || !worker.move) {
      throw new Error('Expected both paths to return a move.');
    }
    expect(sameMove(direct, worker.move)).toBe(true);
  });

  it('ignores stale AI worker responses', () => {
    const apply = shouldApplyAiResponse({
      requestId: 1,
      currentRequestId: 2,
      gameOver: false,
      mode: 'aivai',
      aiVsAiStarted: true,
      aiVsAiRunning: true,
      aiVsAiPaused: false,
      isAiControlled: true
    });

    expect(apply).toBe(false);
  });

  it('requests hints only in human-vs-ai on the human turn', () => {
    const eligible = shouldRequestHint({
      mode: 'hvai',
      hintMode: true,
      activeColor: 'w',
      humanColor: 'w',
      gameOver: false,
      pendingPromotion: false
    });
    expect(eligible).toBe(true);

    const wrongMode = shouldRequestHint({
      mode: 'aivai',
      hintMode: true,
      activeColor: 'w',
      humanColor: 'w',
      gameOver: false,
      pendingPromotion: false
    });
    expect(wrongMode).toBe(false);

    const wrongTurn = shouldRequestHint({
      mode: 'hvai',
      hintMode: true,
      activeColor: 'b',
      humanColor: 'w',
      gameOver: false,
      pendingPromotion: false
    });
    expect(wrongTurn).toBe(false);
  });

  it('ignores stale hint responses by position key', () => {
    const apply = shouldApplyHintResponse({
      requestId: 3,
      currentRequestId: 3,
      positionKey: 'a',
      currentPositionKey: 'b',
      mode: 'hvai',
      hintMode: true,
      activeColor: 'w',
      humanColor: 'w',
      gameOver: false
    });
    expect(apply).toBe(false);
  });

  it('matches worker hint selection for a fixed position', () => {
    const state = createInitialState();
    state.activeColor = 'w';

    const direct = chooseMove(state, {
      color: 'w',
      difficulty: 'easy',
      seed: 5,
      depthOverride: 2
    });
    const worker = computeAiMove({
      kind: 'hint',
      requestId: 7,
      positionKey: 'p',
      state,
      color: 'w',
      depthOverride: 2,
      seed: 5
    });

    expect(direct).not.toBeNull();
    if (!worker || worker.kind !== 'hint') {
      throw new Error('Expected worker response.');
    }
    expect(worker.move).not.toBeNull();
    if (!direct || !worker.move) {
      throw new Error('Expected both paths to return a move.');
    }
    expect(sameMove(direct, worker.move)).toBe(true);
  });

  it('avoids repeating positions when ahead with play-for-win enabled', () => {
    const state = createEmptyState();
    addPiece(state, 'king', 'w', sq(3, 3));
    addPiece(state, 'king', 'b', sq(7, 7));
    addPiece(state, 'pawn', 'w', sq(0, 1));
    state.activeColor = 'w';

    const legalMoves = getAllLegalMoves(state, 'w');
    const moveA = legalMoves.find((move) => move.to.file === 2 && move.to.rank === 3);
    const moveB = legalMoves.find((move) => move.to.file === 4 && move.to.rank === 3);

    if (!moveA || !moveB) {
      throw new Error('Expected two comparable king moves for repetition test.');
    }

    const nextA = cloneState(state);
    nextA.activeColor = 'w';
    applyMove(nextA, moveA);
    const repeatKey = getPositionKey(nextA);

    const chosen = search.findBestMove(state, 'w', {
      depth: 1,
      rng: createSequenceRng([0.1, 0.2, 0]),
      legalMoves: [moveA, moveB],
      playForWin: true,
      recentPositions: [repeatKey],
      repetitionPenalty: 1000,
      repetitionPenaltyScale: 1,
      topMoveWindow: 0
    });

    expect(chosen).not.toBeNull();
    expect(sameMove(chosen as Move, moveA)).toBe(false);
  });

  it('applies play-for-win repetition rules symmetrically', () => {
    const whiteState = createEmptyState();
    addPiece(whiteState, 'king', 'w', sq(3, 3));
    addPiece(whiteState, 'king', 'b', sq(7, 7));
    addPiece(whiteState, 'pawn', 'w', sq(0, 1));
    whiteState.activeColor = 'w';

    const whiteMoves = getAllLegalMoves(whiteState, 'w');
    const whiteRepeat = whiteMoves.find((move) => move.to.file === 2 && move.to.rank === 3);
    const whiteAlt = whiteMoves.find((move) => move.to.file === 4 && move.to.rank === 3);
    if (!whiteRepeat || !whiteAlt) {
      throw new Error('Expected two comparable white king moves.');
    }

    const nextWhite = cloneState(whiteState);
    nextWhite.activeColor = 'w';
    applyMove(nextWhite, whiteRepeat);
    const whiteKey = getPositionKey(nextWhite);

    const chosenWhite = search.findBestMove(whiteState, 'w', {
      depth: 1,
      rng: createSequenceRng([0.1, 0.2, 0]),
      legalMoves: [whiteRepeat, whiteAlt],
      playForWin: true,
      recentPositions: [whiteKey],
      repetitionPenalty: 1000,
      repetitionPenaltyScale: 1,
      topMoveWindow: 0
    });

    const blackState = createEmptyState();
    addPiece(blackState, 'king', 'b', sq(3, 3));
    addPiece(blackState, 'king', 'w', sq(7, 7));
    addPiece(blackState, 'pawn', 'b', sq(0, 6));
    blackState.activeColor = 'b';

    const blackMoves = getAllLegalMoves(blackState, 'b');
    const blackRepeat = blackMoves.find((move) => move.to.file === 2 && move.to.rank === 3);
    const blackAlt = blackMoves.find((move) => move.to.file === 4 && move.to.rank === 3);
    if (!blackRepeat || !blackAlt) {
      throw new Error('Expected two comparable black king moves.');
    }

    const nextBlack = cloneState(blackState);
    nextBlack.activeColor = 'b';
    applyMove(nextBlack, blackRepeat);
    const blackKey = getPositionKey(nextBlack);

    const chosenBlack = search.findBestMove(blackState, 'b', {
      depth: 1,
      rng: createSequenceRng([0.1, 0.2, 0]),
      legalMoves: [blackRepeat, blackAlt],
      playForWin: true,
      recentPositions: [blackKey],
      repetitionPenalty: 1000,
      repetitionPenaltyScale: 1,
      topMoveWindow: 0
    });

    expect(chosenWhite).not.toBeNull();
    expect(chosenBlack).not.toBeNull();
    expect(sameMove(chosenWhite as Move, whiteRepeat)).toBe(false);
    expect(sameMove(chosenBlack as Move, blackRepeat)).toBe(false);
  });

  it('allows repetition when clearly worse with play-for-win enabled', () => {
    const state = createEmptyState();
    addPiece(state, 'king', 'w', sq(3, 3));
    addPiece(state, 'king', 'b', sq(7, 7));
    addPiece(state, 'queen', 'b', sq(0, 6));
    state.activeColor = 'w';

    const legalMoves = getAllLegalMoves(state, 'w');
    const repeatMove = legalMoves.find((move) => move.to.file === 2 && move.to.rank === 3);
    const altMove = legalMoves.find((move) => move.to.file === 4 && move.to.rank === 3);

    if (!repeatMove || !altMove) {
      throw new Error('Expected two comparable king moves for repetition test.');
    }

    const next = cloneState(state);
    next.activeColor = 'w';
    applyMove(next, repeatMove);
    const repeatKey = getPositionKey(next);

    const chosen = search.findBestMove(state, 'w', {
      depth: 1,
      rng: createSequenceRng([0.1, 0.2, 0]),
      legalMoves: [repeatMove, altMove],
      playForWin: true,
      recentPositions: [repeatKey],
      repetitionPenalty: 1000,
      repetitionPenaltyScale: 1,
      topMoveWindow: 0,
      fairnessWindow: 0
    });

    expect(chosen).not.toBeNull();
    expect(sameMove(chosen as Move, repeatMove)).toBe(true);
  });

  it('prioritizes TT, killer, and history moves in max-thinking ordering', () => {
    const state = createEmptyState();
    addPiece(state, 'king', 'w', sq(4, 0));
    addPiece(state, 'king', 'b', sq(4, 7));
    state.activeColor = 'w';

    const moves = getAllLegalMoves(state, 'w');
    const preferred = moves.find((move) => move.to.file === 4 && move.to.rank === 1);
    const killer = moves.find((move) => move.to.file === 3 && move.to.rank === 0);
    const historyMove = moves.find((move) => move.to.file === 5 && move.to.rank === 0);

    if (!preferred || !killer || !historyMove) {
      throw new Error('Expected three distinct king moves for ordering test.');
    }

    const ordering = search.createOrderingState(4);
    ordering.killerMoves[0].primary = killer;
    const historyIndex =
      (historyMove.from.rank * 8 + historyMove.from.file) * 64 +
      (historyMove.to.rank * 8 + historyMove.to.file);
    ordering.history[historyIndex] = 5000;

    const ordered = search.orderMovesForTest(state, moves, 'w', () => 0.5, {
      preferred,
      maxThinking: true,
      ordering,
      ply: 0
    });

    expect(sameMove(ordered[0], preferred)).toBe(true);
    const killerIndex = ordered.findIndex((move) => sameMove(move, killer));
    const historyIdx = ordered.findIndex((move) => sameMove(move, historyMove));
    expect(killerIndex).toBeGreaterThan(-1);
    expect(historyIdx).toBeGreaterThan(-1);
    expect(killerIndex).toBeLessThan(historyIdx);
  });

  it('respects the max thinking time budget', () => {
    const state = createInitialState();
    const legalMoves = getAllLegalMoves(state, 'w');
    const nowValues = [0, 30, 80, 130];
    let nowIndex = 0;
    const depths: number[] = [];
    const now = () => {
      const value = nowValues[Math.min(nowIndex, nowValues.length - 1)];
      nowIndex += 1;
      return value;
    };

    const move = search.findBestMoveTimed(state, 'w', {
      maxDepth: 4,
      maxTimeMs: 100,
      rng: () => 0,
      legalMoves,
      now,
      onDepth: (depth) => depths.push(depth)
    });

    expect(move).not.toBeNull();
    expect(depths.length).toBeGreaterThanOrEqual(1);
    expect(depths[0]).toBe(1);
    for (let i = 1; i < depths.length; i += 1) {
      expect(depths[i]).toBe(depths[i - 1] + 1);
    }
  });

  it('retries aspiration windows on score swings (deterministic)', () => {
    const retries = search.simulateAspirationRetriesForTest([100, 5], 0, 10, 3);
    expect(retries).toBe(1);
  });

  it('deprioritizes a poisoned pawn capture in max thinking ordering', () => {
    const state = createEmptyState();
    addPiece(state, 'king', 'w', sq(4, 0));
    addPiece(state, 'queen', 'w', sq(3, 0));
    addPiece(state, 'king', 'b', sq(0, 7));
    addPiece(state, 'rook', 'b', sq(3, 7));
    addPiece(state, 'pawn', 'b', sq(3, 6));
    state.activeColor = 'w';

    const moves = getAllLegalMoves(state, 'w');
    const capture = moves.find(
      (move) => move.from.file === 3 && move.from.rank === 0 && move.to.file === 3 && move.to.rank === 6
    );
    const quiet = moves.find(
      (move) => move.from.file === 3 && move.from.rank === 0 && move.to.file === 3 && move.to.rank === 1
    );

    if (!capture || !quiet) {
      throw new Error('Expected queen capture and quiet move for SEE-lite test.');
    }

    const ordered = search.orderMovesForTest(state, moves, 'w', () => 0.5, {
      maxThinking: true,
      ply: 0
    });
    const captureIndex = ordered.findIndex((move) => sameMove(move, capture));
    const quietIndex = ordered.findIndex((move) => sameMove(move, quiet));
    expect(captureIndex).toBeGreaterThan(quietIndex);
  });

  it('keeps winning captures and checks eligible for quiescence', () => {
    const state = createEmptyState();
    addPiece(state, 'king', 'w', sq(4, 0));
    addPiece(state, 'king', 'b', sq(4, 7));
    addPiece(state, 'pawn', 'w', sq(4, 4));
    addPiece(state, 'queen', 'b', sq(3, 5));
    state.activeColor = 'w';

    const moves = getAllLegalMoves(state, 'w');
    const capture = moves.find(
      (move) => move.from.file === 4 && move.from.rank === 4 && move.to.file === 3 && move.to.rank === 5
    );
    if (!capture) {
      throw new Error('Expected pawn capture for SEE-lite test.');
    }

    const net = search.seeLiteNetForTest(state, capture, 'w');
    expect(net).toBeGreaterThan(0);
    expect(search.shouldPruneCaptureForTest(state, capture, 'w')).toBe(false);

    const checkState = createEmptyState();
    addPiece(checkState, 'king', 'w', sq(4, 0));
    addPiece(checkState, 'queen', 'w', sq(3, 0));
    addPiece(checkState, 'king', 'b', sq(4, 7));
    addPiece(checkState, 'rook', 'b', sq(3, 7));
    addPiece(checkState, 'pawn', 'b', sq(3, 6));
    checkState.activeColor = 'w';

    const checkMoves = getAllLegalMoves(checkState, 'w');
    const checkingCapture = checkMoves.find(
      (move) => move.from.file === 3 && move.from.rank === 0 && move.to.file === 3 && move.to.rank === 6
    );
    if (!checkingCapture) {
      throw new Error('Expected checking capture for SEE-lite test.');
    }
    expect(search.shouldPruneCaptureForTest(checkState, checkingCapture, 'w')).toBe(false);
  });

  it('applies late-move reductions only for later quiet moves', () => {
    expect(search.getLmrReductionForTest(4, 4, false, true)).toBe(1);
    expect(search.getLmrReductionForTest(2, 4, false, true)).toBe(0);
    expect(search.getLmrReductionForTest(4, 1, false, true)).toBe(0);
    expect(search.getLmrReductionForTest(4, 4, true, true)).toBe(0);
    expect(search.getLmrReductionForTest(4, 4, false, false)).toBe(0);
  });

  it('disables null-move pruning in pawn-only endgames', () => {
    const state = createEmptyState();
    addPiece(state, 'king', 'w', sq(4, 0));
    addPiece(state, 'king', 'b', sq(4, 7));
    addPiece(state, 'pawn', 'w', sq(0, 1));
    addPiece(state, 'pawn', 'b', sq(7, 6));
    state.activeColor = 'w';

    expect(search.shouldAllowNullMoveForTest(state, 'w')).toBe(false);
  });

  it('allows null-move pruning in middlegames with material', () => {
    const state = createInitialState();
    state.activeColor = 'w';
    expect(search.shouldAllowNullMoveForTest(state, 'w')).toBe(true);
  });

  it('ignores stale explain responses by request or position', () => {
    const apply = shouldApplyExplainResponse({
      requestId: 2,
      currentRequestId: 3,
      positionKey: 'a',
      currentPositionKey: 'a',
      moveSignature: 'm1',
      currentMoveSignature: 'm1',
      gameOver: false
    });
    expect(apply).toBe(false);

    const wrongKey = shouldApplyExplainResponse({
      requestId: 4,
      currentRequestId: 4,
      positionKey: 'a',
      currentPositionKey: 'b',
      moveSignature: 'm1',
      currentMoveSignature: 'm1',
      gameOver: false
    });
    expect(wrongKey).toBe(false);
  });

  it('pauses AI vs AI while an explanation modal is open', () => {
    const shouldPause = shouldPauseForExplanation({
      mode: 'aivai',
      aiVsAiStarted: true,
      aiVsAiRunning: true,
      gameOver: false
    });
    expect(shouldPause).toBe(true);

    const alreadyPaused = shouldPauseForExplanation({
      mode: 'aivai',
      aiVsAiStarted: true,
      aiVsAiRunning: false,
      gameOver: false
    });
    expect(alreadyPaused).toBe(false);
  });

  it('resumes AI vs AI after the explanation modal closes', () => {
    const shouldResume = shouldResumeAfterExplanation({
      mode: 'aivai',
      aiVsAiStarted: true,
      gameOver: false
    });
    expect(shouldResume).toBe(true);

    const gameOver = shouldResumeAfterExplanation({
      mode: 'aivai',
      aiVsAiStarted: true,
      gameOver: true
    });
    expect(gameOver).toBe(false);
  });

  it('routes explain requests to the explain worker', () => {
    const state = createInitialState();
    const aiWorker = { postMessage: () => undefined };
    const explainWorker = { postMessage: () => undefined };
    const request = {
      kind: 'explain',
      requestId: 1,
      positionKey: 'p',
      moveSignature: 'm',
      state,
      move: { from: sq(4, 1), to: sq(4, 3) },
      options: {}
    } as const;

    const worker = selectWorkerForRequest(request, aiWorker, explainWorker);
    expect(worker).toBe(explainWorker);
  });

  it('routes non-explain requests to the AI worker', () => {
    const state = createInitialState();
    const aiWorker = { postMessage: () => undefined };
    const explainWorker = { postMessage: () => undefined };
    const request = {
      kind: 'move',
      requestId: 2,
      state,
      color: 'b',
      difficulty: 'easy'
    } as const;

    const worker = selectWorkerForRequest(request, aiWorker, explainWorker);
    expect(worker).toBe(aiWorker);
  });

  it('explains en passant captures', () => {
    const state = createEmptyState();
    addPiece(state, 'king', 'w', sq(4, 0));
    addPiece(state, 'king', 'b', sq(4, 7));
    addPiece(state, 'pawn', 'w', sq(4, 4));
    addPiece(state, 'pawn', 'b', sq(3, 6));

    state.activeColor = 'b';
    applyMove(state, { from: sq(3, 6), to: sq(3, 4) });

    const moves = getLegalMovesForSquare(state, sq(4, 4));
    const enPassant = moves.find((move) => move.isEnPassant);
    expect(enPassant).toBeTruthy();
    if (!enPassant) {
      throw new Error('Expected en passant move to be available.');
    }

    const explanation = explainMove(state, enPassant);
    const hasEnPassant = explanation.bullets.some((bullet) =>
      bullet.toLowerCase().includes('en passant')
    );
    expect(hasEnPassant).toBe(true);
  });

  it('explains checking moves', () => {
    const state = createEmptyState();
    addPiece(state, 'king', 'w', sq(0, 0));
    addPiece(state, 'king', 'b', sq(4, 7));
    addPiece(state, 'rook', 'w', sq(4, 0));
    state.activeColor = 'w';

    const moves = getLegalMovesForSquare(state, sq(4, 0));
    const checkingMove = moves.find(
      (move) => move.to.file === 4 && move.to.rank === 6
    );
    expect(checkingMove).toBeTruthy();
    if (!checkingMove) {
      throw new Error('Expected a checking rook move.');
    }

    const explanation = explainMove(state, checkingMove);
    const hasCheck = explanation.bullets.some((bullet) =>
      bullet.toLowerCase().includes('gives check')
    );
    expect(hasCheck).toBe(true);
  });

  it('explains checking moves for black', () => {
    const state = createEmptyState();
    addPiece(state, 'king', 'w', sq(4, 0));
    addPiece(state, 'king', 'b', sq(7, 7));
    addPiece(state, 'rook', 'b', sq(4, 6));
    state.activeColor = 'b';

    const moves = getLegalMovesForSquare(state, sq(4, 6));
    const checkingMove = moves.find(
      (move) => move.to.file === 4 && move.to.rank === 1
    );
    expect(checkingMove).toBeTruthy();
    if (!checkingMove) {
      throw new Error('Expected a checking rook move for black.');
    }

    const explanation = explainMove(state, checkingMove);
    const hasCheck = explanation.bullets.some((bullet) =>
      bullet.toLowerCase().includes('gives check')
    );
    expect(hasCheck).toBe(true);
  });

  it('explains castling moves', () => {
    const state = createEmptyState();
    addPiece(state, 'king', 'w', sq(4, 0));
    addPiece(state, 'rook', 'w', sq(7, 0));
    addPiece(state, 'king', 'b', sq(4, 7));
    state.castlingRights = { wK: true, wQ: false, bK: false, bQ: false };

    const moves = getLegalMovesForSquare(state, sq(4, 0));
    const castle = moves.find((move) => move.isCastle);
    expect(castle).toBeTruthy();
    if (!castle) {
      throw new Error('Expected castling move to be available.');
    }

    const explanation = explainMove(state, castle);
    const hasCastle = explanation.bullets.some((bullet) =>
      bullet.toLowerCase().includes('castles')
    );
    expect(hasCastle).toBe(true);
  });

  it('applies early queen penalties only in max thinking', () => {
    const state = createEmptyState();
    addPiece(state, 'king', 'w', sq(4, 0));
    addPiece(state, 'king', 'b', sq(4, 7));
    addPiece(state, 'queen', 'w', sq(3, 2), true);
    addPiece(state, 'queen', 'b', sq(3, 7));
    addPiece(state, 'knight', 'w', sq(1, 0));
    addPiece(state, 'bishop', 'w', sq(2, 0));
    addPiece(state, 'knight', 'b', sq(1, 7));
    addPiece(state, 'bishop', 'b', sq(2, 7));
    state.fullmoveNumber = 2;

    const base = evaluateState(state, 'w');
    const max = evaluateState(state, 'w', { maxThinking: true });
    expect(max).toBeLessThan(base);
  });

  it('rewards central minor placement in max thinking', () => {
    const edgeState = createEmptyState();
    addPiece(edgeState, 'king', 'w', sq(4, 0));
    addPiece(edgeState, 'king', 'b', sq(4, 7));
    addPiece(edgeState, 'knight', 'w', sq(1, 0));
    addPiece(edgeState, 'knight', 'b', sq(1, 7));

    const centerState = createEmptyState();
    addPiece(centerState, 'king', 'w', sq(4, 0));
    addPiece(centerState, 'king', 'b', sq(4, 7));
    addPiece(centerState, 'knight', 'w', sq(2, 2), true);
    addPiece(centerState, 'knight', 'b', sq(1, 7));

    const edgeScore = evaluateState(edgeState, 'w', { maxThinking: true });
    const centerScore = evaluateState(centerState, 'w', { maxThinking: true });
    expect(centerScore).toBeGreaterThan(edgeScore);
  });

  it('uses quiescence to avoid bad captures in max thinking', () => {
    const state = createEmptyState();
    addPiece(state, 'king', 'w', sq(4, 0));
    addPiece(state, 'king', 'b', sq(4, 7));
    addPiece(state, 'queen', 'w', sq(3, 0));
    addPiece(state, 'rook', 'b', sq(3, 7));
    addPiece(state, 'pawn', 'b', sq(3, 6));
    state.activeColor = 'w';

    const legalMoves = getAllLegalMoves(state, 'w');
    const capture = legalMoves.find(
      (move) => move.from.file === 3 && move.from.rank === 0 && move.to.file === 3 && move.to.rank === 6
    );
    const quiet = legalMoves.find(
      (move) => move.from.file === 3 && move.from.rank === 0 && move.to.file === 4 && move.to.rank === 1
    );

    if (!capture || !quiet) {
      throw new Error('Expected capture and quiet queen moves.');
    }

    const withoutQuiescence = search.findBestMove(state, 'w', {
      depth: 1,
      rng: () => 0,
      legalMoves: [capture, quiet],
      maxThinking: false
    });

    const withQuiescence = search.findBestMove(state, 'w', {
      depth: 1,
      rng: () => 0,
      legalMoves: [capture, quiet],
      maxThinking: true
    });

    expect(withoutQuiescence).not.toBeNull();
    expect(withQuiescence).not.toBeNull();
    expect(sameMove(withQuiescence as Move, capture)).toBe(false);
  });
});
