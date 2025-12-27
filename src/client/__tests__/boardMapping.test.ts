import { describe, expect, it } from 'vitest';
import { isDarkSquare, squareToWorld } from '../boardMapping';

describe('board mapping', () => {
  it('treats a1 as dark and d1 as light', () => {
    expect(isDarkSquare(0, 0)).toBe(true);
    expect(isDarkSquare(3, 0)).toBe(false);
    expect(isDarkSquare(4, 0)).toBe(true);
  });

  it('maps a1 to the lower-left corner in world space', () => {
    const pos = squareToWorld({ file: 0, rank: 0 });
    expect(pos.x).toBeLessThan(0);
    expect(pos.z).toBeLessThan(0);
  });
});
