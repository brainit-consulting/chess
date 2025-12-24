import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Color, PieceType } from '../../rules';

type ModelTemplate = {
  object: THREE.Group;
  scale: THREE.Vector3;
};

type Manifest = Record<PieceType, string>;

const BASE_URL = import.meta.env.BASE_URL;
const MANIFEST_URL = `${BASE_URL}assets/chess/standard/glb/manifest.json`;
const MODELS_BASE = `${BASE_URL}assets/chess/standard/glb/`;

const TARGET_HEIGHTS: Record<PieceType, number> = {
  pawn: 0.6,
  rook: 0.85,
  knight: 0.9,
  bishop: 0.95,
  queen: 1.1,
  king: 1.2
};

const STANDARD_HEIGHT_SCALE = 0.95;
const STANDARD_SCALE_Y = 1.3;
const STANDARD_SCALE_XZ = 1.40;
const STANDARD_ROTATE_X = -Math.PI / 2;

const MATERIAL_TINTS: Record<Color, { color: string; metalness: number; roughness: number }> = {
  w: { color: '#e8e3d8', metalness: 0.28, roughness: 0.55 },
  b: { color: '#2b2f3a', metalness: 0.32, roughness: 0.6 }
};

const templates = new Map<PieceType, ModelTemplate>();
const tintedMaterialCache = new Map<string, THREE.Material | THREE.Material[]>();
let preloadPromise: Promise<void> | null = null;

export function preloadStandardModels(): Promise<void> {
  if (preloadPromise) {
    return preloadPromise;
  }

  preloadPromise = (async () => {
    const manifest = await loadManifest();
    const loader = new GLTFLoader();
    const entries = Object.entries(manifest) as [PieceType, string][];

    await Promise.all(
      entries.map(async ([type, path]) => {
        const url = resolveModelPath(path);
        const gltf = await loader.loadAsync(url);
        const template = normalizeModel(gltf.scene, TARGET_HEIGHTS[type]);
        templates.set(type, template);
      })
    );
  })();

  return preloadPromise;
}

export function createStandardPieceInstance(
  type: PieceType,
  color: Color,
  id: number
): THREE.Group {
  const template = templates.get(type);

  if (!template) {
    throw new Error('Standard chess models are not ready yet.');
  }

  const clone = template.object.clone(true);
  clone.scale.copy(template.scale);
  if (type === 'knight' && color === 'w') {
    clone.rotation.y = Math.PI;
  }

  const tag = { pickType: 'piece', pieceId: id, type };
  clone.userData = { ...tag };
  clone.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      mesh.material = tintMaterial(mesh.material, color);
      mesh.castShadow = true;
      mesh.userData = { ...tag };
    }
  });

  return clone;
}

async function loadManifest(): Promise<Manifest> {
  const response = await fetch(MANIFEST_URL);
  if (!response.ok) {
    throw new Error(`Failed to load chess manifest (${response.status}).`);
  }
  return (await response.json()) as Manifest;
}

function resolveModelPath(path: string): string {
  if (path.startsWith('http') || path.startsWith(BASE_URL) || path.startsWith('/')) {
    return path;
  }
  return `${MODELS_BASE}${path}`;
}

function tintMaterial(
  source: THREE.Material | THREE.Material[],
  color: Color
): THREE.Material | THREE.Material[] {
  if (Array.isArray(source)) {
    return source.map((item) => tintMaterial(item, color) as THREE.Material);
  }

  const key = `${color}-${source.uuid}`;
  const cached = tintedMaterialCache.get(key);
  if (cached) {
    return cached as THREE.Material;
  }

  let tinted: THREE.MeshStandardMaterial;
  if (source instanceof THREE.MeshStandardMaterial) {
    tinted = source.clone();
    tinted.color.set(MATERIAL_TINTS[color].color);
    // Override surface params for consistent readability across sets.
    tinted.metalness = MATERIAL_TINTS[color].metalness;
    tinted.roughness = MATERIAL_TINTS[color].roughness;
  } else {
    const map = (source as THREE.MeshStandardMaterial).map ?? null;
    tinted = new THREE.MeshStandardMaterial({
      map,
      color: MATERIAL_TINTS[color].color,
      metalness: MATERIAL_TINTS[color].metalness,
      roughness: MATERIAL_TINTS[color].roughness
    });
  }

  tintedMaterialCache.set(key, tinted);
  return tinted;
}

function normalizeModel(object: THREE.Group, targetHeight: number): ModelTemplate {
  object.position.set(0, 0, 0);
  object.rotation.set(0, 0, 0);
  object.scale.set(1, 1, 1);
  object.updateMatrixWorld(true);

  // Blender-exported GLBs are Z-up; rotate once so Y-up matches the board.
  object.rotation.x = STANDARD_ROTATE_X;
  object.updateMatrixWorld(true);

  const orientedBox = new THREE.Box3().setFromObject(object);
  const orientedSize = orientedBox.getSize(new THREE.Vector3());
  const safeHeight = Math.max(orientedSize.y, 0.001);
  const scaleValue = (targetHeight * STANDARD_HEIGHT_SCALE) / safeHeight;

  object.scale.set(
    scaleValue * STANDARD_SCALE_XZ,
    scaleValue * STANDARD_SCALE_Y,
    scaleValue * STANDARD_SCALE_XZ
  );
  object.updateMatrixWorld(true);

  const scaledBox = new THREE.Box3().setFromObject(object);
  const center = scaledBox.getCenter(new THREE.Vector3());

  // Center on X/Z and lift the base to y=0 after rotation + scale.
  object.position.set(-center.x, -scaledBox.min.y, -center.z);

  const root = new THREE.Group();
  root.add(object);
  return { object: root, scale: new THREE.Vector3(1, 1, 1) };
}
