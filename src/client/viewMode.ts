import { ViewMode } from '../types';

export const DEFAULT_VIEW_MODE: ViewMode = '2d';
export const VIEW_MODE_STORAGE_KEY = 'chess.viewMode';

/** Board is 8 tiles wide; coordinate labels sit about 0.62 tiles outside it. */
const BOARD_HALF_EXTENT = 4;
const BOARD_MARGIN = 0.9;
const TWO_D_CAMERA_HEIGHT = 20;

export function parseViewMode(raw: string | null | undefined): ViewMode {
  return raw === '2d' || raw === '3d' ? raw : DEFAULT_VIEW_MODE;
}

export function loadViewMode(storage: Pick<Storage, 'getItem'> | null): ViewMode {
  if (!storage) {
    return DEFAULT_VIEW_MODE;
  }
  try {
    return parseViewMode(storage.getItem(VIEW_MODE_STORAGE_KEY));
  } catch {
    return DEFAULT_VIEW_MODE;
  }
}

export function saveViewMode(storage: Pick<Storage, 'setItem'> | null, mode: ViewMode): void {
  if (!storage) {
    return;
  }
  try {
    storage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  } catch {
    // Ignore persistence failures so the view still switches.
  }
}

export type OrthoFrustum = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

/** Frustum that keeps the whole board (plus labels) visible at any aspect ratio. */
export function computeOrthoFrustum(
  aspect: number,
  halfExtent = BOARD_HALF_EXTENT + BOARD_MARGIN
): OrthoFrustum {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const halfHeight = safeAspect >= 1 ? halfExtent : halfExtent / safeAspect;
  const halfWidth = halfHeight * safeAspect;
  return { left: -halfWidth, right: halfWidth, top: halfHeight, bottom: -halfHeight };
}

export type TwoDPose = {
  position: [number, number, number];
  up: [number, number, number];
};

/**
 * Straight-down pose. White sits at -z in world space, so "up" on screen is +z
 * for white at the bottom and -z when the board is flipped for black.
 */
export function twoDPose(orientation: 'white' | 'black'): TwoDPose {
  return {
    position: [0, TWO_D_CAMERA_HEIGHT, 0],
    up: orientation === 'black' ? [0, 0, -1] : [0, 0, 1]
  };
}
