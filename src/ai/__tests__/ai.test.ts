import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { chooseMove, chooseMoveWithMetrics } from '../ai';
import { explainMove } from '../aiExplain';
import { computeAiMove } from '../aiWorker';
import { evaluateState } from '../evaluate';
import {
  buildAccumulator,
  createZeroWeights,
  getNnueWeights,
  parseNnueWeights,
  setNnueWeights,
  updateAccumulatorForMove
} from '../nnue';
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
  getPieceSquares,
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

  it('returns the same move with instrumentation enabled', () => {
    const state = createInitialState();
    state.activeColor = 'w';
    const options = { difficulty: 'medium' as const, seed: 42 };

    const direct = chooseMove(cloneState(state), options);
    const instrumented = chooseMoveWithMetrics(cloneState(state), options);

    expect(direct).not.toBeNull();
    expect(instrumented.move).not.toBeNull();
    if (!direct || !instrumented.move) {
      throw new Error('Expected both paths to return a move.');
    }
    expect(sameMove(direct, instrumented.move)).toBe(true);
  });

  it('returns a legal move under a tight time budget', () => {
    const state = createInitialState();
    state.activeColor = 'w';
    const legalMoves = getAllLegalMoves(state, 'w');
    let t = 0;
    const now = () => {
      t += 5;
      return t;
    };
    const move = search.findBestMoveTimed(state, 'w', {
      maxDepth: 3,
      maxTimeMs: 5,
      rng: createSequenceRng([0.1]),
      legalMoves,
      maxThinking: false,
      now
    });

    expect(move).not.toBeNull();
    if (!move) {
      throw new Error('Expected a move under tight time limits.');
    }
    expect(legalMoves.some((candidate) => sameMove(candidate, move))).toBe(true);
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

  it('avoids near repetition when an alternative is close in score', () => {
    const state = createEmptyState();
    addPiece(state, 'king', 'w', sq(3, 3));
    addPiece(state, 'king', 'b', sq(7, 7));
    addPiece(state, 'pawn', 'w', sq(0, 1));
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
      repetitionPenalty: 0,
      repetitionPenaltyScale: 1,
      topMoveWindow: 0,
      fairnessWindow: 0
    });

    expect(chosen).not.toBeNull();
    expect(sameMove(chosen as Move, repeatMove)).toBe(false);
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
      hardRepetitionNudgeScale: 1,
      topMoveWindow: 0,
      fairnessWindow: 0
    });

    expect(chosen).not.toBeNull();
    expect(sameMove(chosen as Move, repeatMove)).toBe(true);
  });

  it('does not penalize repetition when below the draw-hold threshold', () => {
    const repeatMove: Move = { from: sq(0, 0), to: sq(1, 0) };
    const altMove: Move = { from: sq(0, 0), to: sq(2, 0) };
    const scores = [
      { move: repeatMove, baseScore: -100, score: -100, repeatCount: 1, isRepeat: true },
      { move: altMove, baseScore: -110, score: -110, repeatCount: 0, isRepeat: false }
    ];

    const adjusted = search.applyRepetitionPolicyForTest(
      scores,
      {
        repetitionPenalty: 50,
        repetitionPenaltyScale: 1,
        drawHoldThreshold: -80,
        recentPositions: ['x']
      },
      true
    );

    const repeatScore = adjusted.find((entry) => entry.move === repeatMove)?.score ?? 0;
    expect(repeatScore).toBe(-100);
  });

  it('detects recaptures on the last move square', () => {
    const state = createEmptyState();
    addPiece(state, 'king', 'w', sq(4, 0));
    addPiece(state, 'king', 'b', sq(4, 7));
    addPiece(state, 'rook', 'w', sq(0, 0));
    addPiece(state, 'pawn', 'b', sq(0, 1));
    addPiece(state, 'pawn', 'b', sq(1, 1));
    state.activeColor = 'w';
    state.lastMove = { from: sq(0, 2), to: sq(0, 1) };

    const recapture = { from: sq(0, 0), to: sq(0, 1) };
    expect(search.isRecaptureForTest(state, recapture)).toBe(true);

    const differentCapture = { from: sq(0, 0), to: sq(1, 1) };
    expect(search.isRecaptureForTest(state, differentCapture)).toBe(false);

    const noLastMove = cloneState(state);
    noLastMove.lastMove = null;
    expect(search.isRecaptureForTest(noLastMove, recapture)).toBe(false);

    const quietMove = { from: sq(0, 0), to: sq(0, 2) };
    expect(search.isRecaptureForTest(state, quietMove)).toBe(false);
  });

  it('avoids rook shuffle repeats when a quiet improvement exists', () => {
    const state = createEmptyState();
    addPiece(state, 'king', 'w', sq(4, 0));
    addPiece(state, 'rook', 'w', sq(7, 0));
    addPiece(state, 'king', 'b', sq(4, 7));
    state.activeColor = 'w';
    state.castlingRights = { wK: true, wQ: false, bK: false, bQ: false };

    const legalMoves = getAllLegalMoves(state, 'w');
    const repeatMove = legalMoves.find(
      (move) => move.from.file === 7 && move.from.rank === 0 && move.to.file === 7 && move.to.rank === 1
    );
    const castleMove = legalMoves.find((move) => move.isCastle);

    if (!repeatMove || !castleMove) {
      throw new Error('Expected rook shuffle and castling moves for repeat test.');
    }

    const next = cloneState(state);
    next.activeColor = 'w';
    applyMove(next, repeatMove);
    const repeatKey = getPositionKey(next);

    const chosen = search.findBestMove(state, 'w', {
      depth: 1,
      rng: () => 0,
      legalMoves: [repeatMove, castleMove],
      playForWin: true,
      recentPositions: [repeatKey],
      repetitionPenalty: 0,
      repetitionPenaltyScale: 0,
      hardRepetitionNudgeScale: 0,
      repeatBanWindowCp: 0,
      twoPlyRepeatPenalty: 0,
      contemptCp: 0,
      topMoveWindow: 0,
      fairnessWindow: 0
    });

    expect(chosen).not.toBeNull();
    expect(sameMove(chosen as Move, repeatMove)).toBe(false);
  });

  it('uses a wider tie-break window with higher repetition scale', () => {
    const repeatMove: Move = { from: sq(0, 0), to: sq(1, 0) };
    const altMove: Move = { from: sq(0, 0), to: sq(0, 1) };
    const scores = [
      { move: repeatMove, baseScore: 50, score: 50, repeatCount: 1, isRepeat: true },
      { move: altMove, baseScore: 30, score: 30, repeatCount: 0, isRepeat: false }
    ];

    const hardCandidates = search.getRepetitionTieBreakCandidatesForTest(
      scores,
      { repetitionPenaltyScale: 1, hardRepetitionNudgeScale: 0, recentPositions: ['x'] },
      true
    );
    const maxCandidates = search.getRepetitionTieBreakCandidatesForTest(
      scores,
      { repetitionPenaltyScale: 2, hardRepetitionNudgeScale: 0, recentPositions: ['x'] },
      true
    );

    expect(hardCandidates.length).toBe(0);
    expect(maxCandidates.length).toBe(1);
    expect(maxCandidates[0].move).toBe(altMove);
  });

  it('nudges Hard away from near repetition when slightly ahead', () => {
    const repeatMove: Move = { from: sq(0, 0), to: sq(1, 0) };
    const altMove: Move = { from: sq(0, 0), to: sq(0, 1) };
    const scores = [
      { move: repeatMove, baseScore: 50, score: 50, repeatCount: 1, isRepeat: true },
      { move: altMove, baseScore: 30, score: 30, repeatCount: 0, isRepeat: false }
    ];

    const withoutNudge = search.getRepetitionTieBreakCandidatesForTest(
      scores,
      { repetitionPenaltyScale: 1, hardRepetitionNudgeScale: 0, recentPositions: ['x'] },
      true
    );
    const withNudge = search.getRepetitionTieBreakCandidatesForTest(
      scores,
      { repetitionPenaltyScale: 1, hardRepetitionNudgeScale: 1, recentPositions: ['x'] },
      true
    );

    expect(withoutNudge.length).toBe(0);
    expect(withNudge.length).toBe(1);
    expect(withNudge[0].move).toBe(altMove);
  });

  it('prefers a non-repeat within the avoidance window when not losing', () => {
    const repeatMove: Move = { from: sq(0, 0), to: sq(1, 0) };
    const altMove: Move = { from: sq(0, 0), to: sq(0, 1) };
    const scores = [
      { move: repeatMove, baseScore: 100, score: 100, repeatCount: 1, isRepeat: true },
      { move: altMove, baseScore: 92, score: 92, repeatCount: 0, isRepeat: false }
    ];

    const chosen = search.chooseWithRepetitionAvoidanceForTest(scores, scores, {
      repeatBanWindowCp: 12,
      drawHoldThreshold: -50
    });

    expect(chosen).toBe(altMove);
  });

  it('allows repetition when outside the avoidance window or clearly worse', () => {
    const repeatMove: Move = { from: sq(0, 0), to: sq(1, 0) };
    const altMove: Move = { from: sq(0, 0), to: sq(0, 1) };
    const scores = [
      { move: repeatMove, baseScore: -250, score: -250, repeatCount: 1, isRepeat: true },
      { move: altMove, baseScore: -260, score: -260, repeatCount: 0, isRepeat: false }
    ];

    const chosen = search.chooseWithRepetitionAvoidanceForTest(scores, scores, {
      repeatBanWindowCp: 20,
      drawHoldThreshold: -50
    });

    expect(chosen).toBe(repeatMove);
  });

  it('uses a larger avoidance window for Max than Hard', () => {
    const repeatMove: Move = { from: sq(0, 0), to: sq(1, 0) };
    const altMove: Move = { from: sq(0, 0), to: sq(0, 1) };
    const scores = [
      { move: repeatMove, baseScore: 100, score: 100, repeatCount: 1, isRepeat: true },
      { move: altMove, baseScore: 92, score: 92, repeatCount: 0, isRepeat: false }
    ];

    const hardChoice = search.chooseWithRepetitionAvoidanceForTest(scores, scores, {
      repeatBanWindowCp: 5,
      drawHoldThreshold: -50
    });
    const maxChoice = search.chooseWithRepetitionAvoidanceForTest(scores, scores, {
      repeatBanWindowCp: 15,
      drawHoldThreshold: -50
    });

    expect(hardChoice).toBe(repeatMove);
    expect(maxChoice).toBe(altMove);
  });

  it('applies contempt to repeating root moves when not losing', () => {
    const repeatMove: Move = { from: sq(0, 0), to: sq(1, 0) };
    const altMove: Move = { from: sq(0, 0), to: sq(0, 1) };
    const scores = [
      { move: repeatMove, baseScore: 10, score: 10, repeatCount: 1, isRepeat: true },
      { move: altMove, baseScore: 9, score: 9, repeatCount: 0, isRepeat: false }
    ];

    const adjusted = search.applyRootContemptForTest(
      scores,
      { contemptCp: 10, drawHoldThreshold: -80, recentPositions: ['x'] },
      true
    );
    const repeatScore = adjusted.find((entry) => entry.move === repeatMove)?.score ?? 0;
    const altScore = adjusted.find((entry) => entry.move === altMove)?.score ?? 0;

    expect(repeatScore).toBeLessThan(altScore);
  });

  it('allows repetition with contempt when losing', () => {
    const repeatMove: Move = { from: sq(0, 0), to: sq(1, 0) };
    const altMove: Move = { from: sq(0, 0), to: sq(0, 1) };
    const scores = [
      { move: repeatMove, baseScore: -200, score: -200, repeatCount: 1, isRepeat: true },
      { move: altMove, baseScore: -210, score: -210, repeatCount: 0, isRepeat: false }
    ];

    const adjusted = search.applyRootContemptForTest(
      scores,
      { contemptCp: 20, drawHoldThreshold: -80, recentPositions: ['x'] },
      true
    );
    const repeatScore = adjusted.find((entry) => entry.move === repeatMove)?.score ?? 0;
    const altScore = adjusted.find((entry) => entry.move === altMove)?.score ?? 0;

    expect(repeatScore).toBeGreaterThanOrEqual(altScore);
  });

  it('penalizes drawish repeats when a non-repeat exists', () => {
    const repeatMove: Move = { from: sq(0, 0), to: sq(1, 0) };
    const altMove: Move = { from: sq(0, 0), to: sq(0, 1) };
    const scores = [
      {
        move: repeatMove,
        baseScore: 20,
        score: 20,
        repeatCount: 1,
        isRepeat: true,
        givesCheck: false
      },
      {
        move: altMove,
        baseScore: 15,
        score: 15,
        repeatCount: 0,
        isRepeat: false,
        givesCheck: false
      }
    ];

    const adjusted = search.applyDrawishRepeatPenaltyForTest(
      scores,
      { recentPositions: ['x'] },
      true
    );
    const repeatScore = adjusted.find((entry) => entry.move === repeatMove)?.score ?? 0;
    const altScore = adjusted.find((entry) => entry.move === altMove)?.score ?? 0;

    expect(repeatScore).toBeLessThan(altScore);
  });

  it('does not penalize repeating checks in drawish positions', () => {
    const repeatMove: Move = { from: sq(0, 0), to: sq(1, 0) };
    const altMove: Move = { from: sq(0, 0), to: sq(0, 1) };
    const scores = [
      {
        move: repeatMove,
        baseScore: 10,
        score: 10,
        repeatCount: 1,
        isRepeat: true,
        givesCheck: true
      },
      {
        move: altMove,
        baseScore: 9,
        score: 9,
        repeatCount: 0,
        isRepeat: false,
        givesCheck: false
      }
    ];

    const adjusted = search.applyDrawishRepeatPenaltyForTest(
      scores,
      { recentPositions: ['x'] },
      true
    );
    const repeatScore = adjusted.find((entry) => entry.move === repeatMove)?.score ?? 0;

    expect(repeatScore).toBe(10);
  });

  it('keeps PVS selection consistent with full-window search', () => {
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
      throw new Error('Expected capture and quiet queen moves for PVS test.');
    }

    const baseline = search.findBestMove(state, 'w', {
      depth: 2,
      rng: () => 0,
      legalMoves: [capture, quiet],
      maxThinking: true,
      usePvs: false,
      topMoveWindow: 0,
      fairnessWindow: 0
    });
    const pvs = search.findBestMove(state, 'w', {
      depth: 2,
      rng: () => 0,
      legalMoves: [capture, quiet],
      maxThinking: true,
      usePvs: true,
      topMoveWindow: 0,
      fairnessWindow: 0
    });

    expect(baseline).not.toBeNull();
    expect(pvs).not.toBeNull();
    expect(sameMove(baseline as Move, pvs as Move)).toBe(true);
  });

  it('boosts countermove ordering for quiet moves', () => {
    const state = createEmptyState();
    addPiece(state, 'king', 'w', sq(4, 0));
    addPiece(state, 'king', 'b', sq(4, 7));
    state.activeColor = 'w';

    const previousMove: Move = { from: sq(4, 7), to: sq(4, 6) };
    state.lastMove = previousMove;

    const moves = getAllLegalMoves(state, 'w');
    const counter = moves.find((move) => move.to.file === 4 && move.to.rank === 1);
    const alternative = moves.find((move) => move.to.file === 3 && move.to.rank === 0);

    if (!counter || !alternative) {
      throw new Error('Expected two quiet king moves for countermove test.');
    }

    const ordering = search.createOrderingState(4);
    const counterIndex =
      (previousMove.from.rank * 8 + previousMove.from.file) * 64 +
      (previousMove.to.rank * 8 + previousMove.to.file);
    ordering.counterMoves[counterIndex] = counter;

    const ordered = search.orderMovesForTest(state, moves, 'w', () => 0.5, {
      maxThinking: true,
      ordering,
      ply: 0,
      prevMove: state.lastMove
    });

    expect(sameMove(ordered[0], counter)).toBe(true);
  });

  it('uses hard micro-quiescence to avoid losing captures', () => {
    const state = createEmptyState();
    addPiece(state, 'king', 'w', sq(6, 0));
    addPiece(state, 'king', 'b', sq(6, 7));
    addPiece(state, 'queen', 'w', sq(4, 1));
    addPiece(state, 'rook', 'b', sq(4, 7));
    addPiece(state, 'pawn', 'b', sq(4, 6));
    state.activeColor = 'w';

    const legalMoves = getAllLegalMoves(state, 'w');
    const capture = legalMoves.find(
      (move) => move.from.file === 4 && move.from.rank === 1 && move.to.file === 4 && move.to.rank === 6
    );
    const safe = legalMoves.find(
      (move) => move.from.file === 4 && move.from.rank === 1 && move.to.file === 4 && move.to.rank === 3
    );
    if (!capture || !safe) {
      throw new Error('Expected capture and quiet queen moves for micro-quiescence test.');
    }

    const noMicroQ = search.findBestMove(state, 'w', {
      depth: 1,
      rng: createSequenceRng([0.9, 0.1, 0]),
      legalMoves: [capture, safe],
      topMoveWindow: 0,
      fairnessWindow: 0,
      maxThinking: false
    });
    const withMicroQ = search.findBestMove(state, 'w', {
      depth: 1,
      rng: createSequenceRng([0.9, 0.1, 0]),
      legalMoves: [capture, safe],
      microQuiescenceDepth: 1,
      topMoveWindow: 0,
      fairnessWindow: 0,
      maxThinking: false
    });

    expect(noMicroQ).not.toBeNull();
    expect(withMicroQ).not.toBeNull();
    expect(sameMove(noMicroQ as Move, capture)).toBe(true);
    expect(sameMove(withMicroQ as Move, safe)).toBe(true);
  });

  it('reuses hard TT best moves across repeated searches', () => {
    const state = createEmptyState();
    addPiece(state, 'king', 'w', sq(3, 3));
    addPiece(state, 'king', 'b', sq(7, 7));
    state.activeColor = 'w';

    const moves = getAllLegalMoves(state, 'w');
    const moveA = moves.find((move) => move.to.file === 2 && move.to.rank === 3);
    const moveB = moves.find((move) => move.to.file === 4 && move.to.rank === 3);
    if (!moveA || !moveB) {
      throw new Error('Expected two comparable king moves for TT test.');
    }

    const tt = search.createHardTt();
    const first = search.findBestMove(state, 'w', {
      depth: 1,
      rng: createSequenceRng([0.9, 0.1, 0]),
      legalMoves: [moveA, moveB],
      tt,
      topMoveWindow: 0,
      fairnessWindow: 0,
      maxThinking: false
    });
    const second = search.findBestMove(state, 'w', {
      depth: 1,
      rng: createSequenceRng([0.1, 0.9, 0]),
      legalMoves: [moveA, moveB],
      tt,
      topMoveWindow: 0,
      fairnessWindow: 0,
      maxThinking: false
    });

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    const cached = tt.get(getPositionKey(state));
    expect(cached?.bestMove).toBeDefined();
    expect(sameMove(second as Move, cached?.bestMove as Move)).toBe(true);
  });

  it('keeps max evaluation at least as strong as hard', () => {
    const state = createEmptyState();
    addPiece(state, 'king', 'w', sq(6, 0));
    addPiece(state, 'rook', 'w', sq(5, 0));
    addPiece(state, 'pawn', 'w', sq(5, 1));
    addPiece(state, 'pawn', 'w', sq(6, 1));
    addPiece(state, 'pawn', 'w', sq(7, 1));
    addPiece(state, 'queen', 'w', sq(3, 0));
    addPiece(state, 'king', 'b', sq(4, 7));
    addPiece(state, 'queen', 'b', sq(3, 7));
    state.fullmoveNumber = 8;

    const hardScore = evaluateState(state, 'w', { maxThinking: false });
    const maxScore = evaluateState(state, 'w', { maxThinking: true });

    expect(maxScore).toBeGreaterThanOrEqual(hardScore);
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

  it('orders check evasions ahead of non-evasions when in check', () => {
    const state = createEmptyState();
    addPiece(state, 'king', 'w', sq(4, 0));
    addPiece(state, 'rook', 'w', sq(0, 0));
    addPiece(state, 'rook', 'b', sq(4, 7));
    addPiece(state, 'king', 'b', sq(7, 7));
    state.activeColor = 'w';

    const nonEvasion = { from: sq(0, 0), to: sq(0, 1) };
    const evasion = { from: sq(4, 0), to: sq(5, 0) };

    const ordered = search.orderMovesForTest(state, [nonEvasion, evasion], 'w', () => 0.5, {
      maxThinking: false,
      ply: 0
    });

    expect(sameMove(ordered[0], evasion)).toBe(true);
  });

  it('orders check evasions by capture, block, then king move', () => {
    const state = createEmptyState();
    addPiece(state, 'king', 'w', sq(4, 0));
    addPiece(state, 'pawn', 'w', sq(0, 2));
    addPiece(state, 'pawn', 'w', sq(2, 1));
    addPiece(state, 'bishop', 'b', sq(1, 3));
    addPiece(state, 'king', 'b', sq(7, 7));
    state.activeColor = 'w';

    const capture = { from: sq(0, 2), to: sq(1, 3) };
    const block = { from: sq(2, 1), to: sq(2, 2) };
    const kingMove = { from: sq(4, 0), to: sq(5, 0) };

    const ordered = search.orderMovesForTest(state, [kingMove, block, capture], 'w', () => 0.5, {
      maxThinking: false,
      ply: 0
    });

    expect(sameMove(ordered[0], capture)).toBe(true);
    expect(sameMove(ordered[1], block)).toBe(true);
    expect(sameMove(ordered[2], kingMove)).toBe(true);
  });

  it('ranks unsafe king evasions below safe ones', () => {
    const state = createEmptyState();
    addPiece(state, 'king', 'w', sq(4, 0));
    addPiece(state, 'pawn', 'w', sq(0, 2));
    addPiece(state, 'bishop', 'b', sq(1, 3));
    addPiece(state, 'rook', 'b', sq(5, 7));
    addPiece(state, 'king', 'b', sq(7, 7));
    state.activeColor = 'w';

    const unsafeKingMove = { from: sq(4, 0), to: sq(5, 0) };
    const safeKingMove = { from: sq(4, 0), to: sq(3, 0) };

    const ordered = search.orderMovesForTest(
      state,
      [unsafeKingMove, safeKingMove],
      'w',
      () => 0.5,
      {
        maxThinking: false,
        ply: 0
      }
    );

    expect(sameMove(ordered[0], safeKingMove)).toBe(true);
  });

  it('prefers faster mates and delays being mated', () => {
    const fastWin = search.mateScoreForTest('b', 'w', 2);
    const slowWin = search.mateScoreForTest('b', 'w', 4);
    expect(fastWin).toBeGreaterThan(slowWin);

    const fastLoss = search.mateScoreForTest('w', 'w', 2);
    const slowLoss = search.mateScoreForTest('w', 'w', 4);
    expect(slowLoss).toBeGreaterThan(fastLoss);
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

  it('penalizes exposed kings more when queens are on the board', () => {
    const safe = createEmptyState();
    addPiece(safe, 'king', 'w', sq(4, 0));
    addPiece(safe, 'king', 'b', sq(4, 7));
    addPiece(safe, 'queen', 'w', sq(3, 0));
    addPiece(safe, 'queen', 'b', sq(3, 7));
    safe.castlingRights = { wK: true, wQ: true, bK: true, bQ: true };
    safe.fullmoveNumber = 15;

    const exposed = cloneState(safe);
    const whiteKing = [...exposed.pieces.values()].find(
      (piece) => piece.type === 'king' && piece.color === 'w'
    );
    if (!whiteKing) {
      throw new Error('Expected white king in exposure test.');
    }
    exposed.pieces.set(whiteKing.id, { ...whiteKing });
    const whiteSquare = { file: 4, rank: 1 };
    exposed.board[0][4] = null;
    exposed.board[1][4] = whiteKing.id;
    exposed.pieces.get(whiteKing.id)!.hasMoved = true;
    exposed.castlingRights = { wK: false, wQ: false, bK: true, bQ: true };

    const exposedNoQueens = cloneState(exposed);
    const queenSquares = getPieceSquares(exposedNoQueens);
    for (const piece of [...exposedNoQueens.pieces.values()]) {
      if (piece.type === 'queen') {
        const square = queenSquares.get(piece.id);
        if (square) {
          exposedNoQueens.board[square.rank][square.file] = null;
        }
        exposedNoQueens.pieces.delete(piece.id);
      }
    }

    const safeEval = evaluateState(safe, 'w');
    const exposedEval = evaluateState(exposed, 'w');
    const exposedNoQueensEval = evaluateState(exposedNoQueens, 'w');

    expect(exposedEval).toBeLessThan(safeEval);
    expect(exposedNoQueensEval).toBeGreaterThan(exposedEval);
  });

  it('penalizes attacked king ring squares', () => {
    const safe = createEmptyState();
    addPiece(safe, 'king', 'w', sq(4, 0));
    addPiece(safe, 'king', 'b', sq(7, 7));
    addPiece(safe, 'queen', 'w', sq(3, 0));
    addPiece(safe, 'queen', 'b', sq(3, 7));
    addPiece(safe, 'bishop', 'b', sq(0, 6));
    addPiece(safe, 'knight', 'b', sq(0, 3));
    safe.fullmoveNumber = 12;

    const exposed = createEmptyState();
    addPiece(exposed, 'king', 'w', sq(4, 0));
    addPiece(exposed, 'king', 'b', sq(7, 7));
    addPiece(exposed, 'queen', 'w', sq(3, 0));
    addPiece(exposed, 'queen', 'b', sq(3, 7));
    addPiece(exposed, 'bishop', 'b', sq(2, 4));
    addPiece(exposed, 'knight', 'b', sq(2, 2));
    exposed.fullmoveNumber = 12;

    const safeEval = evaluateState(safe, 'w');
    const exposedEval = evaluateState(exposed, 'w');
    expect(exposedEval).toBeLessThan(safeEval);
  });

  it('applies king ring penalties symmetrically for each side', () => {
    const attackedWhite = createEmptyState();
    addPiece(attackedWhite, 'king', 'w', sq(4, 0));
    addPiece(attackedWhite, 'king', 'b', sq(7, 7));
    addPiece(attackedWhite, 'queen', 'w', sq(3, 0));
    addPiece(attackedWhite, 'queen', 'b', sq(3, 7));
    addPiece(attackedWhite, 'bishop', 'b', sq(2, 4));
    addPiece(attackedWhite, 'knight', 'b', sq(2, 2));
    attackedWhite.fullmoveNumber = 12;

    const attackedBlack = createEmptyState();
    addPiece(attackedBlack, 'king', 'w', sq(7, 0));
    addPiece(attackedBlack, 'king', 'b', sq(4, 7));
    addPiece(attackedBlack, 'queen', 'w', sq(3, 0));
    addPiece(attackedBlack, 'queen', 'b', sq(3, 7));
    addPiece(attackedBlack, 'bishop', 'w', sq(2, 3));
    addPiece(attackedBlack, 'knight', 'w', sq(2, 5));
    attackedBlack.fullmoveNumber = 12;

    const whiteUnderFire = evaluateState(attackedWhite, 'w');
    const blackUnderFire = evaluateState(attackedBlack, 'w');
    expect(blackUnderFire).toBeGreaterThan(whiteUnderFire);
  });

  it('skips king ring penalties when queens are off the board', () => {
    const withQueens = createEmptyState();
    addPiece(withQueens, 'king', 'w', sq(4, 0));
    addPiece(withQueens, 'king', 'b', sq(7, 7));
    addPiece(withQueens, 'queen', 'w', sq(3, 0));
    addPiece(withQueens, 'queen', 'b', sq(3, 7));
    addPiece(withQueens, 'bishop', 'b', sq(2, 4));
    addPiece(withQueens, 'knight', 'b', sq(2, 2));
    withQueens.fullmoveNumber = 12;

    const withoutQueens = cloneState(withQueens);
    const squares = getPieceSquares(withoutQueens);
    for (const piece of [...withoutQueens.pieces.values()]) {
      if (piece.type !== 'queen') {
        continue;
      }
      const square = squares.get(piece.id);
      if (square) {
        withoutQueens.board[square.rank][square.file] = null;
      }
      withoutQueens.pieces.delete(piece.id);
    }

    const queenEval = evaluateState(withQueens, 'w');
    const noQueenEval = evaluateState(withoutQueens, 'w');
    expect(queenEval).toBeLessThan(noQueenEval);
  });

  it('rewards rook pressure on open files toward the king', () => {
    const pressure = createEmptyState();
    addPiece(pressure, 'king', 'w', sq(6, 0));
    addPiece(pressure, 'king', 'b', sq(4, 7));
    addPiece(pressure, 'rook', 'w', sq(3, 1));
    pressure.fullmoveNumber = 15;

    const noPressure = cloneState(pressure);
    const rook = [...noPressure.pieces.values()].find(
      (piece) => piece.type === 'rook' && piece.color === 'w'
    );
    if (!rook) {
      throw new Error('Expected rook in file pressure test.');
    }
    noPressure.pieces.set(rook.id, { ...rook });
    noPressure.board[1][3] = null;
    noPressure.board[1][0] = rook.id;

    const pressureEval = evaluateState(pressure, 'w');
    const noPressureEval = evaluateState(noPressure, 'w');

    expect(pressureEval).toBeGreaterThan(noPressureEval);
  });

  it('penalizes early queen moves in core eval', () => {
    const base = createEmptyState();
    addPiece(base, 'king', 'w', sq(4, 0));
    addPiece(base, 'king', 'b', sq(4, 7));
    addPiece(base, 'queen', 'w', sq(3, 0));
    addPiece(base, 'queen', 'b', sq(3, 7));
    addPiece(base, 'knight', 'w', sq(6, 0));
    addPiece(base, 'knight', 'b', sq(6, 7));
    base.fullmoveNumber = 2;

    const movedWhite = cloneState(base);
    const whiteQueen = [...movedWhite.pieces.values()].find(
      (piece) => piece.type === 'queen' && piece.color === 'w'
    );
    if (!whiteQueen) {
      throw new Error('Expected white queen for early queen penalty test.');
    }
    movedWhite.pieces.set(whiteQueen.id, { ...whiteQueen, hasMoved: true });

    const movedBlack = cloneState(base);
    const blackQueen = [...movedBlack.pieces.values()].find(
      (piece) => piece.type === 'queen' && piece.color === 'b'
    );
    if (!blackQueen) {
      throw new Error('Expected black queen for early queen penalty test.');
    }
    movedBlack.pieces.set(blackQueen.id, { ...blackQueen, hasMoved: true });

    const baseEval = evaluateState(base, 'w', { maxThinking: false });
    const movedWhiteEval = evaluateState(movedWhite, 'w', { maxThinking: false });
    const movedBlackEval = evaluateState(movedBlack, 'w', { maxThinking: false });

    expect(movedWhiteEval).toBeLessThan(baseEval);
    expect(movedBlackEval).toBeGreaterThan(baseEval);
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

  it('extends by one ply when side to move is in check', () => {
    const state = createEmptyState();
    addPiece(state, 'king', 'w', sq(4, 0));
    addPiece(state, 'king', 'b', sq(0, 7));
    addPiece(state, 'rook', 'b', sq(4, 7));
    state.activeColor = 'w';

    const legalMoves = getAllLegalMoves(state, 'w');
    if (legalMoves.length === 0) {
      throw new Error('Expected evasions while in check.');
    }
    const move = legalMoves[0];
    const next = cloneState(state);
    applyMove(next, move);
    const extension = search.getForcingExtensionForTest(state, next, move, 'w', 2, 0);
    expect(extension).toBe(1);
  });

  it('extends by one ply on direct recaptures', () => {
    const state = createEmptyState();
    addPiece(state, 'king', 'w', sq(4, 0));
    addPiece(state, 'king', 'b', sq(7, 7));
    addPiece(state, 'rook', 'w', sq(3, 0));
    addPiece(state, 'rook', 'b', sq(3, 3));
    state.activeColor = 'w';
    state.lastMove = { from: sq(3, 6), to: sq(3, 3) };

    const legalMoves = getAllLegalMoves(state, 'w');
    const recapture = legalMoves.find(
      (move) => move.from.file === 3 && move.from.rank === 0 && move.to.file === 3 && move.to.rank === 3
    );
    if (!recapture) {
      throw new Error('Expected a recapture move.');
    }
    const next = cloneState(state);
    applyMove(next, recapture);
    const extension = search.getForcingExtensionForTest(state, next, recapture, 'w', 2, 0);
    expect(extension).toBe(1);
  });

  it('orders true recaptures ahead of quiet moves', () => {
    const state = createEmptyState();
    addPiece(state, 'king', 'w', sq(4, 0));
    addPiece(state, 'king', 'b', sq(4, 7));
    addPiece(state, 'pawn', 'w', sq(2, 2));
    addPiece(state, 'pawn', 'b', sq(3, 3));
    state.activeColor = 'w';
    state.lastMove = { from: sq(3, 4), to: sq(3, 3) };

    const legalMoves = getAllLegalMoves(state, 'w');
    const recapture = legalMoves.find(
      (move) => move.from.file === 2 && move.from.rank === 2 && move.to.file === 3 && move.to.rank === 3
    );
    const quiet = legalMoves.find(
      (move) => move.from.file === 4 && move.from.rank === 0 && move.to.file === 4 && move.to.rank === 1
    );

    if (!recapture || !quiet) {
      throw new Error('Expected recapture and quiet moves for ordering test.');
    }

    const ordered = search.orderMovesForTest(state, legalMoves, 'w', () => 0, {
      maxThinking: true,
      prevMove: state.lastMove
    });
    const recaptureIndex = ordered.findIndex((move) => sameMove(move, recapture));
    const quietIndex = ordered.findIndex((move) => sameMove(move, quiet));
    expect(recaptureIndex).toBeGreaterThanOrEqual(0);
    expect(quietIndex).toBeGreaterThanOrEqual(0);
    expect(recaptureIndex).toBeLessThan(quietIndex);
  });

  it('penalizes immediate backtracks at root when a close alternative exists', () => {
    const state = createEmptyState();
    addPiece(state, 'king', 'w', sq(4, 0));
    addPiece(state, 'king', 'b', sq(4, 7));
    addPiece(state, 'rook', 'w', sq(0, 1));
    state.activeColor = 'w';
    state.lastMoveByColor = { w: { from: sq(0, 0), to: sq(0, 1) }, b: null };

    const backtrack: Move = { from: sq(0, 1), to: sq(0, 0) };
    const improve: Move = { from: sq(0, 1), to: sq(0, 2) };

    const chosen = search.findBestMove(state, 'w', {
      depth: 1,
      rng: () => 0,
      legalMoves: [backtrack, improve],
      topMoveWindow: 0,
      fairnessWindow: 0
    });

    expect(chosen).not.toBeNull();
    expect(sameMove(chosen as Move, backtrack)).toBe(false);
  });

  it('does not penalize backtracks when alternatives are significantly worse', () => {
    const state = createEmptyState();
    addPiece(state, 'king', 'w', sq(4, 0));
    addPiece(state, 'king', 'b', sq(4, 7));
    addPiece(state, 'rook', 'w', sq(0, 1));
    state.activeColor = 'w';
    state.lastMoveByColor = { w: { from: sq(0, 0), to: sq(0, 1) }, b: null };

    const backtrack: Move = { from: sq(0, 1), to: sq(0, 0) };
    const blunder: Move = { from: sq(0, 1), to: sq(1, 1) };

    const adjusted = search.applyRootBacktrackPenaltyForTest(state, 'w', [
      { move: backtrack, baseScore: 0, score: 0, repeatCount: 0, isRepeat: false },
      { move: blunder, baseScore: -400, score: -400, repeatCount: 0, isRepeat: false }
    ]);

    const backtrackScore = adjusted.find((entry) => sameMove(entry.move, backtrack))?.score ?? 0;
    expect(backtrackScore).toBe(0);
  });

  it('penalizes immediate threefold repetition when drawish alternatives exist', () => {
    const state = createEmptyState();
    addPiece(state, 'king', 'w', sq(4, 0));
    addPiece(state, 'king', 'b', sq(4, 7));
    state.activeColor = 'w';

    const repeatMove: Move = { from: sq(4, 0), to: sq(4, 1) };
    const altMove: Move = { from: sq(4, 0), to: sq(3, 0) };

    const adjusted = search.applyRootThreefoldAvoidanceForTest(
      state,
      'w',
      [
        { move: repeatMove, baseScore: 0, score: 0, repeatCount: 2, isRepeat: true },
        { move: altMove, baseScore: -5, score: -5, repeatCount: 0, isRepeat: false }
      ],
      { recentPositions: ['x', 'x'] },
      true
    );

    const repeatScore = adjusted.find((entry) => sameMove(entry.move, repeatMove))?.score ?? 0;
    expect(repeatScore).toBeLessThan(0);
  });

  it('allows threefold repetition when clearly worse', () => {
    const state = createEmptyState();
    addPiece(state, 'king', 'w', sq(4, 0));
    addPiece(state, 'king', 'b', sq(4, 7));
    state.activeColor = 'w';

    const repeatMove: Move = { from: sq(4, 0), to: sq(4, 1) };
    const altMove: Move = { from: sq(4, 0), to: sq(3, 0) };

    const adjusted = search.applyRootThreefoldAvoidanceForTest(
      state,
      'w',
      [
        { move: repeatMove, baseScore: -200, score: -200, repeatCount: 2, isRepeat: true },
        { move: altMove, baseScore: -350, score: -350, repeatCount: 0, isRepeat: false }
      ],
      { recentPositions: ['x', 'x'], drawHoldThreshold: -80 },
      true
    );

    const repeatScore = adjusted.find((entry) => sameMove(entry.move, repeatMove))?.score ?? 0;
    expect(repeatScore).toBe(-200);
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

  it('applies early queen penalties at least as strongly in max thinking', () => {
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
    expect(max).toBeLessThanOrEqual(base);
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

describe('NNUE scaffolding', () => {
  function createTestWeights() {
    const weights = createZeroWeights(768, 2);
    const whiteFeatureCount = 6 * 64;
    for (let feature = 0; feature < 768; feature += 1) {
      const offset = feature * 2;
      if (feature < whiteFeatureCount) {
        weights.w1[offset] = 1;
      } else {
        weights.w1[offset + 1] = 1;
      }
    }
    weights.w2[0] = 1;
    weights.w2[1] = -1;
    return weights;
  }

  function mirrorState(state: GameState): GameState {
    const mirrored = createEmptyState();
    const squares = getPieceSquares(state);
    for (const piece of state.pieces.values()) {
      const square = squares.get(piece.id);
      if (!square) {
        continue;
      }
      const mirrorSquare = { file: 7 - square.file, rank: 7 - square.rank };
      addPiece(
        mirrored,
        piece.type,
        piece.color === 'w' ? 'b' : 'w',
        mirrorSquare,
        piece.hasMoved
      );
    }
    mirrored.activeColor = state.activeColor === 'w' ? 'b' : 'w';
    mirrored.fullmoveNumber = state.fullmoveNumber;
    return mirrored;
  }

  it('parses the default NNUE weights file header', () => {
    const weightPath = path.resolve(
      process.cwd(),
      'src/ai/nnue/weights/Scorpion-NNUE-Weight.snnue'
    );
    const buffer = readFileSync(weightPath);
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    const parsed = parseNnueWeights(arrayBuffer);
    expect(parsed.inputSize).toBe(768);
    expect(parsed.hiddenSize).toBe(64);
    expect(parsed.version).toBe(1);
  });

  it('produces deterministic, mirror-symmetric NNUE eval', () => {
    const prior = getNnueWeights();
    const weights = createTestWeights();
    setNnueWeights(weights);
    try {
      const state = createEmptyState();
      addPiece(state, 'king', 'w', sq(4, 0));
      addPiece(state, 'king', 'b', sq(4, 7));
      addPiece(state, 'pawn', 'w', sq(0, 1));
      const score1 = evaluateState(state, 'w', { maxThinking: true, nnueMix: 1 });
      const score2 = evaluateState(state, 'w', { maxThinking: true, nnueMix: 1 });
      expect(score1).toBe(score2);

      const mirrored = mirrorState(state);
      const mirrorScore = evaluateState(mirrored, 'w', { maxThinking: true, nnueMix: 1 });
      expect(score1).toBe(-mirrorScore);
    } finally {
      setNnueWeights(prior);
    }
  });

  it('keeps accumulator updates consistent across make/unmake', () => {
    const prior = getNnueWeights();
    const weights = createTestWeights();
    setNnueWeights(weights);
    try {
      const state = createEmptyState();
      addPiece(state, 'king', 'w', sq(4, 0));
      addPiece(state, 'king', 'b', sq(4, 7));
      addPiece(state, 'pawn', 'w', sq(0, 1));

      const baseAcc = buildAccumulator(state, weights);
      const move: Move = { from: sq(0, 1), to: sq(0, 2) };
      const next = cloneState(state);
      const updatedAcc = updateAccumulatorForMove(baseAcc, next, move, weights);
      applyMove(next, move);

      const recomputed = buildAccumulator(next, weights);
      expect(Array.from(updatedAcc.accumulator)).toEqual(
        Array.from(recomputed.accumulator)
      );

      const undo: Move = { from: sq(0, 2), to: sq(0, 1) };
      const backAcc = updateAccumulatorForMove(updatedAcc, next, undo, weights);
      applyMove(next, undo);
      expect(Array.from(backAcc.accumulator)).toEqual(
        Array.from(baseAcc.accumulator)
      );
    } finally {
      setNnueWeights(prior);
    }
  });
});
