import { describe, expect, it } from 'vitest';
import { isDarkSquare, squareToWorld } from '../boardMapping';

describe('board mapping', () => {
  it('treats a1 as dark and d1 as light', () => {
    expect(isDarkSquare(0, 0)).toBe(true);
    expect(isDarkSquare(3, 0)).toBe(false);
    expect(isDarkSquare(4, 0)).toBe(true);
    expect(isDarkSquare(3, 7)).toBe(true);
  });

  it('maps a1 to the white near-left corner in world space', () => {
    const a1 = squareToWorld({ file: 0, rank: 0 });
    const h1 = squareToWorld({ file: 7, rank: 0 });
    const a8 = squareToWorld({ file: 0, rank: 7 });
    expect(a1.x).toBeGreaterThan(h1.x);
    expect(a1.z).toBeLessThan(a8.z);
  });
});
