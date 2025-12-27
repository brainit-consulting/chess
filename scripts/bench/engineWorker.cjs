require('tsx/cjs');

const { parentPort } = require('node:worker_threads');
const { chooseMove } = require('../../src/ai/ai');

if (!parentPort) {
  throw new Error('engineWorker must be run as a worker thread.');
}

let stopRequested = false;

parentPort.on('message', (message) => {
  if (message && message.kind === 'stop') {
    stopRequested = true;
    return;
  }
  try {
    stopRequested = false;
    const move = chooseMove(message.state, {
      ...message.options,
      color: message.color,
      stopRequested: () => stopRequested
    });
    parentPort.postMessage({ id: message.id, move });
  } catch (error) {
    parentPort.postMessage({
      id: message.id,
      move: null,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});
