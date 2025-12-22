import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { Color, PieceType } from '../../rules';

type ModelTemplate = {
  object: THREE.Group;
  scale: number;
};

const MODEL_PATHS: Record<PieceType, string> = {
  pawn: '/assets/chess/scifi/scifichess-pawn.obj',
  rook: '/assets/chess/scifi/scifichess-rook.obj',
  knight: '/assets/chess/scifi/scifichess-knight.obj',
  bishop: '/assets/chess/scifi/scifichess-bishop.obj',
  queen: '/assets/chess/scifi/scifichess-queen.obj',
  king: '/assets/chess/scifi/scifichess-king.obj'
};

const TEXTURE_PATHS: Record<Color, string> = {
  w: '/assets/chess/scifi/white-chess-scifi.png',
  b: '/assets/chess/scifi/black-chess-scifi.png'
};

const TARGET_HEIGHTS: Record<PieceType, number> = {
  pawn: 0.6,
  rook: 0.85,
  knight: 0.9,
  bishop: 0.95,
  queen: 1.1,
  king: 1.2
};

const templates = new Map<PieceType, ModelTemplate>();
const materials = new Map<Color, THREE.MeshStandardMaterial>();
let preloadPromise: Promise<void> | null = null;

// Cache models/textures once; per-piece instances clone geometry with shared materials.
export function preloadSciFiModels(): Promise<void> {
  if (preloadPromise) {
    return preloadPromise;
  }

  preloadPromise = (async () => {
    const textureLoader = new THREE.TextureLoader();
    const [whiteTexture, blackTexture] = await Promise.all([
      textureLoader.loadAsync(TEXTURE_PATHS.w),
      textureLoader.loadAsync(TEXTURE_PATHS.b)
    ]);

    whiteTexture.colorSpace = THREE.SRGBColorSpace;
    blackTexture.colorSpace = THREE.SRGBColorSpace;

    // Slight tints/emissive lift keep textures readable against the board.
    materials.set(
      'w',
      new THREE.MeshStandardMaterial({
        map: whiteTexture,
        color: '#e6e0d3',
        emissive: '#1e232b',
        emissiveIntensity: 0.18,
        metalness: 0.22,
        roughness: 0.48
      })
    );
    // Dark gray (not pure black) preserves silhouette without crushing detail.
    materials.set(
      'b',
      new THREE.MeshStandardMaterial({
        map: blackTexture,
        color: '#2b2f3a',
        emissive: '#0f131a',
        emissiveIntensity: 0.25,
        metalness: 0.28,
        roughness: 0.58
      })
    );

    const loader = new OBJLoader();
    const entries = Object.entries(MODEL_PATHS) as [PieceType, string][];

    await Promise.all(
      entries.map(async ([type, path]) => {
        const obj = await loader.loadAsync(path);
        const template = normalizeModel(obj, TARGET_HEIGHTS[type]);
        templates.set(type, template);
      })
    );
  })();

  return preloadPromise;
}

export function createSciFiPieceInstance(
  type: PieceType,
  color: Color,
  id: number
): THREE.Group {
  const template = templates.get(type);
  const material = materials.get(color);

  if (!template || !material) {
    throw new Error('Sci-fi chess models are not ready yet.');
  }

  const clone = template.object.clone(true);
  clone.scale.setScalar(template.scale);

  const tag = { pickType: 'piece', pieceId: id, type };
  clone.userData = { ...tag };
  clone.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      mesh.material = material;
      mesh.castShadow = true;
      mesh.userData = { ...tag };
    }
  });

  return clone;
}

function normalizeModel(object: THREE.Group, targetHeight: number): ModelTemplate {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  // Center the mesh on X/Z and lift the base to y=0 for consistent placement.
  object.position.set(-center.x, -box.min.y, -center.z);

  const root = new THREE.Group();
  root.add(object);

  const safeHeight = Math.max(size.y, 0.001);
  const scale = targetHeight / safeHeight;

  return { object: root, scale };
}
