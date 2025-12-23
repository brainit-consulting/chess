import { chooseMove } from './ai';
import { AiWorkerRequest, AiWorkerResponse } from './aiWorkerTypes';

export function computeAiMove(request: AiWorkerRequest): AiWorkerResponse {
  const move = chooseMove(request.state, {
    color: request.color,
    difficulty: request.difficulty,
    seed: request.seed,
    playForWin: request.playForWin,
    recentPositions: request.recentPositions
  });

  return { requestId: request.requestId, move };
}

if (typeof self !== 'undefined') {
  const ctx = self as DedicatedWorkerGlobalScope;
  ctx.onmessage = (event: MessageEvent<AiWorkerRequest>) => {
    const response = computeAiMove(event.data);
    ctx.postMessage(response);
  };
}
