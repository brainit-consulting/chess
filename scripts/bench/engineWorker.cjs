require('tsx/cjs');

const { parentPort } = require('node:worker_threads');
const { chooseMove, chooseMoveWithDiagnostics } = require('../../src/ai/ai');

if (!parentPort) {
  throw new Error('engineWorker must be run as a worker thread.');
}

let stopRequested = false;
let activeId = null;

parentPort.on('message', (message) => {
  if (message && message.kind === 'stop') {
    if (activeId !== null && message.id === activeId) {
      stopRequested = true;
    }
    return;
  }
  try {
    activeId = message.id ?? null;
    stopRequested = false;
    let stopSeen = false;
    const diagnosticsRequested = Boolean(message.options?.diagnostics);
    const baseOptions = {
      ...message.options,
      color: message.color,
      stopRequested: () => {
        if (stopRequested) {
          stopSeen = true;
          return true;
        }
        return false;
      }
    };
    const result = diagnosticsRequested
      ? chooseMoveWithDiagnostics(message.state, baseOptions)
      : { move: chooseMove(message.state, baseOptions), diagnostics: null };
    const debug = process.env.BENCH_DEBUG === '1';
    const meta = debug
      ? {
          usedTimedHard:
            message.options?.difficulty === 'hard' && message.options?.maxTimeMs != null,
          maxTimeMs: message.options?.maxTimeMs ?? null,
          stopRequested: stopSeen
        }
      : undefined;
    parentPort.postMessage({
      id: message.id,
      move: result.move,
      diagnostics: result.diagnostics,
      meta
    });
  } catch (error) {
    parentPort.postMessage({
      id: message.id,
      move: null,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});
