import { chooseMove } from './ai';
import { AiWorkerRequest, AiWorkerResponse } from './aiWorkerTypes';

export function computeAiMove(request: AiWorkerRequest): AiWorkerResponse {
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

  const move = chooseMove(request.state, {
    color: request.color,
    difficulty: request.difficulty,
    seed: request.seed,
    playForWin: request.playForWin,
    recentPositions: request.recentPositions,
    depthOverride: request.depthOverride
  });

  return { kind: 'move', requestId: request.requestId, move };
}

if (typeof self !== 'undefined') {
  const ctx = self as DedicatedWorkerGlobalScope;
  ctx.onmessage = (event: MessageEvent<AiWorkerRequest>) => {
    const response = computeAiMove(event.data);
    ctx.postMessage(response);
  };
}
