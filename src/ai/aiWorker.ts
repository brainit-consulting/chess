import { Move } from '../rules';
import { chooseMove, chooseMoveWithMetrics } from './ai';
import { explainMove } from './aiExplain';
import { AiWorkerRequest, AiWorkerResponse } from './aiWorkerTypes';
import { parseNnueWeights, setNnueWeights } from './nnue';

const HARD_FALLBACK_MS = 1000;

type ProgressUpdate = { depth: number; move: Move | null; score: number | null };

export function computeAiMove(
  request: AiWorkerRequest,
  onProgress?: (update: ProgressUpdate) => void,
  stopRequested?: () => boolean
): AiWorkerResponse | null {
  if (request.kind === 'nnue-weights') {
    try {
      const weights = parseNnueWeights(request.weights);
      setNnueWeights(weights);
      return { kind: 'nnue-weights', requestId: request.requestId, ok: true };
    } catch (error) {
      setNnueWeights(null);
      return {
        kind: 'nnue-weights',
        requestId: request.requestId,
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to parse NNUE weights.'
      };
    }
  }

  if (request.kind === 'hint') {
    const move = chooseMove(request.state, {
      color: request.color,
      difficulty: 'easy',
      seed: request.seed,
      depthOverride: request.depthOverride
    });
    return {
      kind: 'hint',
      requestId: request.requestId,
      positionKey: request.positionKey,
      move
    };
  }

  if (request.kind === 'explain') {
    const explanation = explainMove(request.state, request.move, request.options);
    return {
      kind: 'explain',
      requestId: request.requestId,
      positionKey: request.positionKey,
      moveSignature: request.moveSignature,
      explanation
    };
  }

  if (request.kind === 'stop') {
    return null;
  }

  const maxTimeMs =
    request.difficulty === 'hard' && request.maxTimeMs == null
      ? HARD_FALLBACK_MS
      : request.maxTimeMs;
  if (request.debugTiming) {
    const startedAt = performance.now();
    const { move, metrics } = chooseMoveWithMetrics(request.state, {
      color: request.color,
      difficulty: request.difficulty,
      seed: request.seed,
      playForWin: request.playForWin,
      recentPositions: request.recentPositions,
      depthOverride: request.depthOverride,
      maxTimeMs,
      maxDepth: request.maxDepth,
      nnueMix: request.nnueMix,
      stopRequested,
      onProgress
    });
    const durationMs = performance.now() - startedAt;
    console.log('[AI Worker] done', {
      requestId: request.requestId,
      difficulty: request.difficulty,
      maxTimeMs,
      durationMs,
      depthCompleted: metrics?.depthCompleted,
      nodes: metrics?.nodes,
      nps: metrics?.nps,
      hardStopUsed: metrics?.hardStopUsed,
      softStopUsed: metrics?.softStopUsed
    });
    return { kind: 'move', requestId: request.requestId, move };
  }

  const move = chooseMove(request.state, {
    color: request.color,
    difficulty: request.difficulty,
    seed: request.seed,
    playForWin: request.playForWin,
    recentPositions: request.recentPositions,
    depthOverride: request.depthOverride,
    maxTimeMs,
    maxDepth: request.maxDepth,
    nnueMix: request.nnueMix,
    stopRequested,
    onProgress
  });

  return { kind: 'move', requestId: request.requestId, move };
}

if (typeof self !== 'undefined') {
  const ctx = self as DedicatedWorkerGlobalScope;
  const stopFlags = new Map<number, boolean>();
  ctx.onmessage = (event: MessageEvent<AiWorkerRequest>) => {
    const request = event.data;
    if (request.kind === 'stop') {
      stopFlags.set(request.requestId, true);
      return;
    }
    if (request.kind === 'move') {
      stopFlags.set(request.requestId, false);
      const maxTimeMs =
        request.difficulty === 'hard' && request.maxTimeMs == null
          ? HARD_FALLBACK_MS
          : request.maxTimeMs;
      if (request.debugTiming) {
        console.log('[AI Worker] start', {
          requestId: request.requestId,
          difficulty: request.difficulty,
          maxTimeMs,
          maxDepth: request.maxDepth
        });
      }
      let stopLogged = false;
      const onProgress =
        request.difficulty === 'max'
          ? (update: ProgressUpdate) => {
              ctx.postMessage({
                kind: 'progress',
                requestId: request.requestId,
                move: update.move,
                depth: update.depth,
                score: update.score
              });
            }
          : undefined;
      const response = computeAiMove(
        request,
        onProgress,
        () => {
          const stopped = stopFlags.get(request.requestId) === true;
          if (stopped && request.debugTiming && !stopLogged) {
            stopLogged = true;
            console.log('[AI Worker] stopRequested', { requestId: request.requestId });
          }
          return stopped;
        }
      );
      stopFlags.delete(request.requestId);
      if (response) {
        ctx.postMessage(response);
      }
      return;
    }
    const response = computeAiMove(request);
    if (response) {
      ctx.postMessage(response);
    }
  };
}
