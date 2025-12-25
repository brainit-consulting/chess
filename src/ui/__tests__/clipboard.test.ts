import { describe, expect, it, vi } from 'vitest';
import { copyToClipboard } from '../clipboard';

describe('copyToClipboard', () => {
  it('uses navigator.clipboard when available', async () => {
    const originalNavigator = globalThis.navigator;
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis, 'navigator', {
      value: { clipboard: { writeText } },
      configurable: true
    });

    const success = await copyToClipboard('PGN');
    expect(success).toBe(true);
    expect(writeText).toHaveBeenCalledWith('PGN');

    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      configurable: true
    });
  });

  it('falls back to execCommand when clipboard is unavailable', async () => {
    const originalNavigator = globalThis.navigator;
    const originalDocument = globalThis.document;
    Object.defineProperty(globalThis, 'navigator', {
      value: {},
      configurable: true
    });
    const execSpy = vi.fn(() => true);
    const fakeTextarea = {
      value: '',
      setAttribute: vi.fn(),
      style: {} as Record<string, string>,
      select: vi.fn(),
      setSelectionRange: vi.fn(),
      remove: vi.fn()
    };
    const fakeBody = {
      append: vi.fn()
    };
    Object.defineProperty(globalThis, 'document', {
      value: {
        execCommand: execSpy,
        createElement: vi.fn(() => fakeTextarea),
        body: fakeBody
      },
      configurable: true
    });

    const success = await copyToClipboard('PGN');
    expect(success).toBe(true);
    expect(execSpy).toHaveBeenCalledWith('copy');
    expect(fakeBody.append).toHaveBeenCalledWith(fakeTextarea);

    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      configurable: true
    });
    Object.defineProperty(globalThis, 'document', {
      value: originalDocument,
      configurable: true
    });
  });
});
