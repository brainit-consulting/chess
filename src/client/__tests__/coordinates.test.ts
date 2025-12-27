import { describe, expect, it } from 'vitest';
import { createCoordinateGroup, setCoordinateOrientation } from '../coordinates';

describe('coordinate labels', () => {
  it('creates 16 coordinate sprites', () => {
    const group = createCoordinateGroup(1);
    expect(group.children.length).toBe(16);
  });

  it('maps the bottom-left labels for white view', () => {
    const group = createCoordinateGroup(1);
    setCoordinateOrientation(group, 'white');
    const data = group.userData.coordinates as {
      fileSprites: { userData: { label: string } }[];
      rankSprites: { userData: { label: string } }[];
    };
    expect(data.fileSprites[0].userData.label).toBe('a');
    expect(data.rankSprites[0].userData.label).toBe('1');
  });

  it('maps the bottom-left labels for black view', () => {
    const group = createCoordinateGroup(1);
    setCoordinateOrientation(group, 'black');
    const data = group.userData.coordinates as {
      fileSprites: { userData: { label: string } }[];
      rankSprites: { userData: { label: string } }[];
    };
    expect(data.fileSprites[0].userData.label).toBe('h');
    expect(data.rankSprites[0].userData.label).toBe('1');
  });

  it('toggles visibility', () => {
    const group = createCoordinateGroup(1);
    expect(group.visible).toBe(true);
    group.visible = false;
    expect(group.visible).toBe(false);
  });
});
