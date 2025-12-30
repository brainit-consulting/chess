import { parentPort } from 'node:worker_threads';
import {
  chooseMove,
  chooseMoveWithDiagnostics,
  type AiOptions,
  type AiMoveWithDiagnostics
} from '../../src/ai/ai.ts';
import type { Color, GameState, Move } from '../../src/rules/index.ts';
import type { RootDiagnostics } from '../../src/ai/search.ts';

type EngineRequest = {
  id: number;
  state: GameState;
  color: Color;
  options: AiOptions & { diagnostics?: boolean };
};

type EngineStop = {
  kind: 'stop';
  id: number;
};

type EngineResponse = {
  id: number;
  move: Move | null;
  diagnostics?: RootDiagnostics | null;
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
    const diagnosticsRequested = Boolean(request.options?.diagnostics);
    const baseOptions = { ...request.options, color: request.color };
    let result: AiMoveWithDiagnostics;
    if (diagnosticsRequested) {
      const { diagnostics: _ignored, ...options } = baseOptions;
      result = chooseMoveWithDiagnostics(request.state, options);
    } else {
      const move = chooseMove(request.state, baseOptions);
      result = { move, diagnostics: null };
    }
    const response: EngineResponse = {
      id: request.id,
      move: result.move,
      diagnostics: result.diagnostics
    };
    parentPort?.postMessage(response);
  } catch (error) {
    const response: EngineResponse = {
      id: request.id,
      move: null,
      diagnostics: null,
      error: error instanceof Error ? error.message : String(error)
    };
    parentPort?.postMessage(response);
  }
});
