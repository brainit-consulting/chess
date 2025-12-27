import { parentPort } from 'node:worker_threads';
import { chooseMove, type AiOptions } from '../../src/ai/ai.ts';
import type { Color, GameState, Move } from '../../src/rules/index.ts';

type EngineRequest = {
  id: number;
  state: GameState;
  color: Color;
  options: AiOptions;
};

type EngineStop = {
  kind: 'stop';
  id: number;
};

type EngineResponse = {
  id: number;
  move: Move | null;
  error?: string;
};

if (!parentPort) {
  throw new Error('engineWorker must be run as a worker thread.');
}

parentPort.on('message', (message: EngineRequest | EngineStop) => {
  if ('kind' in message && message.kind === 'stop') {
    return;
  }
  const request = message as EngineRequest;
  try {
    const move = chooseMove(request.state, {
      ...request.options,
      color: request.color
    });
    const response: EngineResponse = { id: request.id, move };
    parentPort?.postMessage(response);
  } catch (error) {
    const response: EngineResponse = {
      id: request.id,
      move: null,
      error: error instanceof Error ? error.message : String(error)
    };
    parentPort?.postMessage(response);
  }
});
