import { describe, expect, it } from 'vitest';
import {
  DEFAULT_VIEW_MODE,
  VIEW_MODE_STORAGE_KEY,
  computeOrthoFrustum,
  loadViewMode,
  parseViewMode,
  saveViewMode,
  twoDPose
} from '../viewMode';
import { squareToWorld } from '../boardMapping';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value)
  };
}

describe('view mode setting', () => {
  it('defaults to 2D when nothing is stored', () => {
    expect(DEFAULT_VIEW_MODE).toBe('2d');
    expect(loadViewMode(memoryStorage())).toBe('2d');
    expect(loadViewMode(null)).toBe('2d');
  });

  it('round-trips through storage under chess.viewMode', () => {
    const storage = memoryStorage();
    saveViewMode(storage, '3d');
    expect(storage.getItem(VIEW_MODE_STORAGE_KEY)).toBe('3d');
    expect(loadViewMode(storage)).toBe('3d');
    saveViewMode(storage, '2d');
    expect(loadViewMode(storage)).toBe('2d');
  });

  it('falls back to the default for junk values', () => {
    expect(parseViewMode('iso')).toBe('2d');
    expect(parseViewMode('')).toBe('2d');
    expect(parseViewMode(undefined)).toBe('2d');
  });

  it('survives storage that throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      }
    };
    expect(loadViewMode(broken)).toBe('2d');
    expect(() => saveViewMode(broken, '3d')).not.toThrow();
  });
});

describe('2D camera config', () => {
  it('keeps the whole board visible and tiles square at any aspect', () => {
    for (const aspect of [0.4, 1, 1.6, 2.4]) {
      const f = computeOrthoFrustum(aspect);
      const width = f.right - f.left;
      const height = f.top - f.bottom;
      expect(width / height).toBeCloseTo(aspect, 5);
      expect(Math.min(width, height)).toBeGreaterThanOrEqual(8);
    }
  });

  it('survives a zero or invalid aspect during resize', () => {
    const f = computeOrthoFrustum(0);
    expect(Number.isFinite(f.left)).toBe(true);
    expect(computeOrthoFrustum(NaN).right).toBeGreaterThan(0);
  });

  it('looks straight down', () => {
    const white = twoDPose('white');
    expect(white.position[0]).toBe(0);
    expect(white.position[2]).toBe(0);
    expect(white.position[1]).toBeGreaterThan(0);
  });

  it('puts white at the bottom and flips for black', () => {
    // White ranks sit at -z; camera up of +z puts -z at the bottom of the screen.
    const a1 = squareToWorld({ file: 0, rank: 0 });
    const a8 = squareToWorld({ file: 0, rank: 7 });
    expect(a1.z).toBeLessThan(a8.z);
    expect(twoDPose('white').up).toEqual([0, 0, 1]);
    expect(twoDPose('black').up).toEqual([0, 0, -1]);
  });
});
