import { Square } from '../rules';

export type WorldPosition = { x: number; y: number; z: number };

export function isDarkSquare(file: number, rank: number): boolean {
  return (file + rank) % 2 === 0;
}

export function squareToWorld(
  square: Square,
  tileSize = 1,
  y = 0.02
): WorldPosition {
  return {
    x: (square.file - 3.5) * tileSize,
    y,
    z: (square.rank - 3.5) * tileSize
  };
}
