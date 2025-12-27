require('tsx/cjs');

const { parentPort } = require('node:worker_threads');
const { chooseMove } = require('../../src/ai/ai');

if (!parentPort) {
  throw new Error('engineWorker must be run as a worker thread.');
}

parentPort.on('message', (message) => {
  if (message && message.kind === 'stop') {
    return;
  }
  try {
    const move = chooseMove(message.state, {
      ...message.options,
      color: message.color
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
