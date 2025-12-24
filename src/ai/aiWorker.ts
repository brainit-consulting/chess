import { chooseMove } from './ai';
import { explainMove } from './aiExplain';
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
