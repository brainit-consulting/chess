import { EventEmitter } from 'node:events';
import type { Worker } from 'node:worker_threads';
import { describe, expect, it } from 'vitest';
import { runEngineWithTimeout } from '../selfPlay';
import { addPiece, createEmptyState } from '../../../src/rules';

class FakeWorker extends EventEmitter {
  public terminated = false;

  postMessage(message: { id?: number; kind?: string }): void {
    if (message.kind === 'stop') {
      return;
    }
    const move = {
      from: { file: 4, rank: 0 },
      to: { file: 4, rank: 1 }
    };
    const diagnostics = {
      rootTopMoves: [],
      chosenMoveReason: 'non-repeat-best',
      bestRepeatKind: 'none',
      bestIsRepeat: false
    };
    setTimeout(() => {
      this.emit('message', { id: message.id, move, diagnostics });
    }, 20);
  }

  terminate(): void {
    this.terminated = true;
  }
}

describe('bench runEngineWithTimeout diagnostics grace', () => {
  it('records timeouts but captures diagnostics within grace window', async () => {
    const state = createEmptyState();
    addPiece(state, 'king', 'w', { file: 4, rank: 0 });
    addPiece(state, 'king', 'b', { file: 4, rank: 7 });
    state.activeColor = 'w';

    const worker = new FakeWorker();
    const result = await runEngineWithTimeout(
      worker as unknown as Worker,
      state,
      {
        color: 'w',
        difficulty: 'hard',
        maxTimeMs: 5,
        seed: 1,
        diagnostics: true
      },
      5,
      0,
      50
    );

    expect(result.timedOut).toBe(true);
    expect(result.diagnostics).toBeDefined();
    expect(result.move).not.toBeNull();
  });
});
