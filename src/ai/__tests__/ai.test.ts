import { describe, expect, it } from 'vitest';
import { chooseMove } from '../ai';
import { explainMove } from '../aiExplain';
import { computeAiMove } from '../aiWorker';
import {
  shouldApplyAiResponse,
  shouldApplyExplainResponse,
  shouldApplyHintResponse,
  shouldPauseForExplanation,
  shouldRequestHint,
  shouldResumeAfterExplanation,
  selectWorkerForRequest
} from '../aiWorkerClient';
import { findBestMove } from '../search';
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
      gameOver: false,
      pendingPromotion: false
    });
    expect(eligible).toBe(true);

    const wrongMode = shouldRequestHint({
      mode: 'aivai',
      hintMode: true,
      activeColor: 'w',
      gameOver: false,
      pendingPromotion: false
    });
    expect(wrongMode).toBe(false);

    const wrongTurn = shouldRequestHint({
      mode: 'hvai',
      hintMode: true,
      activeColor: 'b',
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
    expect(worker.move).not.toBeNull();
    if (!direct || !worker.move) {
      throw new Error('Expected both paths to return a move.');
    }
    expect(sameMove(direct, worker.move)).toBe(true);
  });

  it('penalizes repeating positions when play-for-win is enabled', () => {
    const state = createEmptyState();
    addPiece(state, 'king', 'w', sq(3, 3));
    addPiece(state, 'king', 'b', sq(7, 7));
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

    const chosen = findBestMove(state, 'w', {
      depth: 1,
      rng: () => 0,
      legalMoves: [moveA, moveB],
      playForWin: true,
      recentPositions: [repeatKey],
      repetitionPenalty: 1000,
      topMoveWindow: 0
    });

    expect(chosen).not.toBeNull();
    expect(sameMove(chosen as Move, moveA)).toBe(false);
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
});
