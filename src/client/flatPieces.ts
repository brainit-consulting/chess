import * as THREE from 'three';
import { Color, PieceType } from '../rules';

// Seen from straight above, the 3D models are indistinguishable discs, so 2D
// mode draws a flat side-on silhouette per piece, like a chess computer's
// board. The shapes are drawn here with canvas paths rather than Unicode chess
// glyphs, because glyph shapes depend on whichever symbol font the OS has.

const FLAT_SIZE = 0.9;
const FLAT_Y = 0.04;
const TEXTURE_PX = 160;
const DESIGN = 100; // shapes below are drawn on a 100 x 100 grid

type Ctx = CanvasRenderingContext2D;

function path(_ctx: Ctx, d: string): Path2D {
  return new Path2D(d);
}

// Every piece stands on the same two-step base.
const BASE = 'M24 90 V82 Q24 80 26 80 H74 Q76 80 76 82 V90 Z M30 80 V74 H70 V80 Z';

const BODY: Record<PieceType, { shapes: string[]; dots?: [number, number, number][]; details?: string[] }> = {
  pawn: {
    shapes: ['M43 47 Q41 62 32 74 H68 Q59 62 57 47 Z', 'M37 44 H63 V50 H37 Z'],
    dots: [[50, 31, 11]]
  },
  rook: {
    shapes: [
      'M30 20 H39 V27 H45 V20 H55 V27 H61 V20 H70 V37 H64 L66 70 L70 74 H30 L34 70 L36 37 H30 Z'
    ]
  },
  bishop: {
    shapes: [
      'M50 20 Q66 32 62 46 Q60 50 58 50 H42 Q40 50 38 46 Q34 32 50 20 Z',
      'M38 50 H62 V56 H38 Z',
      'M42 56 Q40 66 31 74 H69 Q60 66 58 56 Z'
    ],
    dots: [[50, 17, 4.5]],
    details: ['M47 30 L56 40']
  },
  knight: {
    shapes: [
      'M30 74 C30 64 34 58 42 52 C36 50 30 48 24 44 L22 38 C24 34 30 28 36 24 L40 12 L47 20 C61 22 72 34 70 50 C70 60 68 68 70 74 Z'
    ],
    details: ['M40 30 L43 31']
  },
  queen: {
    shapes: ['M36 74 L29 34 L41 50 L45 28 L50 48 L55 28 L59 50 L71 34 L64 74 Z'],
    dots: [
      [29, 30, 4.5],
      [45, 24, 4.5],
      [55, 24, 4.5],
      [71, 30, 4.5],
      [50, 16, 4.5]
    ]
  },
  king: {
    shapes: ['M37 74 Q31 58 41 47 H59 Q69 58 63 74 Z', 'M46 10 H54 V19 H62 V27 H54 V45 H46 V27 H38 V19 H46 Z']
  }
};

const geometry = new THREE.PlaneGeometry(FLAT_SIZE, FLAT_SIZE);
const materialCache = new Map<string, THREE.MeshBasicMaterial>();

function drawPiece(ctx: Ctx, type: PieceType, color: Color): void {
  const white = color === 'w';
  const fill = white ? '#f6efe0' : '#1a1c22';
  const line = white ? '#1a1c22' : '#e9dcc4';
  ctx.save();
  ctx.scale(TEXTURE_PX / DESIGN, TEXTURE_PX / DESIGN);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = 3.2;
  ctx.fillStyle = fill;
  ctx.strokeStyle = line;

  const body = BODY[type];
  for (const d of [BASE, ...body.shapes]) {
    const p = path(ctx, d);
    ctx.fill(p);
    ctx.stroke(p);
  }
  for (const [x, y, r] of body.dots ?? []) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.lineWidth = 2.6;
  for (const d of body.details ?? []) {
    ctx.stroke(path(ctx, d));
  }
  ctx.restore();
}

function getMaterial(type: PieceType, color: Color): THREE.MeshBasicMaterial {
  const key = `${color}:${type}`;
  const cached = materialCache.get(key);
  if (cached) {
    return cached;
  }
  const canvas = document.createElement('canvas');
  canvas.width = TEXTURE_PX;
  canvas.height = TEXTURE_PX;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    drawPiece(ctx, type, color);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
  materialCache.set(key, material);
  return material;
}

/** Flat top-down stand-in for a piece. Tagged so picking resolves to the piece. */
export function createFlatPiece(type: PieceType, color: Color, id: number): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, getMaterial(type, color));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = FLAT_Y;
  mesh.userData = { pickType: 'piece', pieceId: id, type, flat: true };
  return mesh;
}

export function isFlatPiece(object: THREE.Object3D): boolean {
  return object.userData.flat === true;
}
