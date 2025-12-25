import { describe, expect, it } from 'vitest';
import { createCoordinateGroup } from '../coordinates';

describe('coordinate labels', () => {
  it('creates 16 coordinate sprites', () => {
    const group = createCoordinateGroup(1);
    expect(group.children.length).toBe(16);
  });

  it('toggles visibility', () => {
    const group = createCoordinateGroup(1);
    expect(group.visible).toBe(true);
    group.visible = false;
    expect(group.visible).toBe(false);
  });
});
