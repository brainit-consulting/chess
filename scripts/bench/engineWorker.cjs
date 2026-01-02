require('tsx/cjs');

const { parentPort } = require('node:worker_threads');
const fs = require('node:fs');
const path = require('node:path');
const { chooseMove, chooseMoveWithDiagnostics } = require('../../src/ai/ai');
const { parseNnueWeights, setNnueWeights } = require('../../src/ai/nnue');

let loadedNnuePath = null;

function loadNnueWeightsOnce(weightsPath) {
  if (!weightsPath || weightsPath === loadedNnuePath) {
    return;
  }
  const resolved = path.resolve(weightsPath);
  const buffer = fs.readFileSync(resolved);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const weights = parseNnueWeights(arrayBuffer);
  setNnueWeights(weights);
  loadedNnuePath = resolved;
}

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
    const nnueWeightsPath =
      message.options?.nnueWeightsPath ?? process.env.NNUE_WEIGHTS_PATH;
    if (message.options?.difficulty === 'max' && nnueWeightsPath) {
      loadNnueWeightsOnce(nnueWeightsPath);
    }
    const nnueMixEnv = process.env.NNUE_MIX;
    const nnueMix =
      message.options?.difficulty === 'max' && nnueMixEnv
        ? Number(nnueMixEnv)
        : message.options?.nnueMix;
    const baseOptions = {
      ...message.options,
      color: message.color,
      nnueMix,
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
