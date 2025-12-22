import * as THREE from 'three';
import { Color, PieceType } from '../rules';

// Stacked primitives tuned for recognizable silhouettes without heavy geometry.
type PieceMaterials = {
  primary: THREE.MeshStandardMaterial;
  accent: THREE.MeshStandardMaterial;
};

const MATERIALS: Record<Color, PieceMaterials> = {
  w: {
    primary: new THREE.MeshStandardMaterial({
      color: '#f0ede6',
      metalness: 0.25,
      roughness: 0.35,
      emissive: '#20242a',
      emissiveIntensity: 0.22
    }),
    accent: new THREE.MeshStandardMaterial({
      color: '#d7c28a',
      metalness: 0.45,
      roughness: 0.3
    })
  },
  b: {
    primary: new THREE.MeshStandardMaterial({
      color: '#222533',
      metalness: 0.35,
      roughness: 0.45,
      emissive: '#0a0c12',
      emissiveIntensity: 0.35
    }),
    accent: new THREE.MeshStandardMaterial({
      color: '#4b5f8a',
      metalness: 0.5,
      roughness: 0.35
    })
  }
};

const GEOMETRY = {
  baseSmall: new THREE.CylinderGeometry(0.34, 0.4, 0.12, 20),
  baseMedium: new THREE.CylinderGeometry(0.36, 0.44, 0.14, 20),
  baseLarge: new THREE.CylinderGeometry(0.4, 0.48, 0.15, 20),
  bodyPawn: new THREE.CylinderGeometry(0.26, 0.3, 0.32, 18),
  bodyShort: new THREE.CylinderGeometry(0.28, 0.36, 0.4, 18),
  bodyTall: new THREE.CylinderGeometry(0.26, 0.36, 0.75, 18),
  bodyKing: new THREE.CylinderGeometry(0.28, 0.38, 0.85, 18),
  neck: new THREE.CylinderGeometry(0.2, 0.26, 0.18, 16),
  headSmall: new THREE.SphereGeometry(0.18, 16, 12),
  headMedium: new THREE.SphereGeometry(0.22, 16, 12),
  headCylinder: new THREE.CylinderGeometry(0.2, 0.24, 0.2, 16),
  crownRing: new THREE.TorusGeometry(0.22, 0.04, 10, 24),
  pawnRing: new THREE.TorusGeometry(0.17, 0.04, 10, 20),
  rookTop: new THREE.CylinderGeometry(0.36, 0.36, 0.12, 16),
  rookCrenel: new THREE.BoxGeometry(0.16, 0.12, 0.16),
  knightHead: new THREE.ConeGeometry(0.26, 0.5, 10),
  knightJaw: new THREE.BoxGeometry(0.18, 0.18, 0.12),
  bishopNotch: new THREE.BoxGeometry(0.06, 0.32, 0.04),
  kingCrossVertical: new THREE.BoxGeometry(0.06, 0.22, 0.06),
  kingCrossHorizontal: new THREE.BoxGeometry(0.2, 0.06, 0.06)
};

function addPart(
  group: THREE.Group,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  type: PieceType,
  id: number,
  position: [number, number, number],
  rotation?: [number, number, number],
  scale?: [number, number, number]
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(position[0], position[1], position[2]);
  if (rotation) {
    mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  }
  if (scale) {
    mesh.scale.set(scale[0], scale[1], scale[2]);
  }
  mesh.userData = { pickType: 'piece', pieceId: id, type };
  group.add(mesh);
  return mesh;
}

export function createPieceObject(type: PieceType, color: Color, id: number): THREE.Group {
  const materials = MATERIALS[color];
  const group = new THREE.Group();
  group.userData = { pickType: 'piece', pieceId: id, type };

  if (type === 'pawn') {
    addPart(group, GEOMETRY.baseSmall, materials.primary, type, id, [0, 0.06, 0]);
    addPart(group, GEOMETRY.bodyPawn, materials.primary, type, id, [0, 0.28, 0]);
    addPart(group, GEOMETRY.neck, materials.primary, type, id, [0, 0.49, 0]);
    addPart(group, GEOMETRY.headSmall, materials.primary, type, id, [0, 0.74, 0]);
    addPart(group, GEOMETRY.pawnRing, materials.accent, type, id, [0, 0.44, 0], [
      Math.PI / 2,
      0,
      0
    ]);
  } else if (type === 'rook') {
    addPart(group, GEOMETRY.baseMedium, materials.primary, type, id, [0, 0.07, 0]);
    addPart(group, GEOMETRY.bodyShort, materials.primary, type, id, [0, 0.36, 0]);
    addPart(group, GEOMETRY.rookTop, materials.accent, type, id, [0, 0.65, 0]);
    const crenelY = 0.74;
    const offset = 0.18;
    addPart(group, GEOMETRY.rookCrenel, materials.accent, type, id, [offset, crenelY, offset]);
    addPart(group, GEOMETRY.rookCrenel, materials.accent, type, id, [-offset, crenelY, offset]);
    addPart(group, GEOMETRY.rookCrenel, materials.accent, type, id, [offset, crenelY, -offset]);
    addPart(group, GEOMETRY.rookCrenel, materials.accent, type, id, [-offset, crenelY, -offset]);
  } else if (type === 'knight') {
    addPart(group, GEOMETRY.baseMedium, materials.primary, type, id, [0, 0.07, 0]);
    addPart(group, GEOMETRY.bodyShort, materials.primary, type, id, [0, 0.34, 0]);
    addPart(group, GEOMETRY.neck, materials.primary, type, id, [0, 0.58, -0.02]);
    addPart(
      group,
      GEOMETRY.knightHead,
      materials.accent,
      type,
      id,
      [0, 0.86, 0.12],
      [-0.55, 0, 0]
    );
    addPart(group, GEOMETRY.knightJaw, materials.accent, type, id, [0, 0.68, 0.22], [
      -0.2,
      0,
      0
    ]);
  } else if (type === 'bishop') {
    addPart(group, GEOMETRY.baseMedium, materials.primary, type, id, [0, 0.07, 0]);
    addPart(
      group,
      new THREE.CylinderGeometry(0.22, 0.34, 0.6, 18),
      materials.primary,
      type,
      id,
      [0, 0.44, 0]
    );
    addPart(group, GEOMETRY.headMedium, materials.primary, type, id, [0, 0.86, 0], undefined, [
      0.9,
      1.15,
      0.9
    ]);
    addPart(group, GEOMETRY.bishopNotch, materials.accent, type, id, [0, 0.78, 0.2]);
  } else if (type === 'queen') {
    addPart(group, GEOMETRY.baseLarge, materials.primary, type, id, [0, 0.075, 0]);
    addPart(group, GEOMETRY.bodyTall, materials.primary, type, id, [0, 0.515, 0]);
    addPart(group, GEOMETRY.crownRing, materials.accent, type, id, [0, 0.94, 0], [
      Math.PI / 2,
      0,
      0
    ]);
    const crownRadius = 0.22;
    for (let i = 0; i < 6; i += 1) {
      const angle = (i / 6) * Math.PI * 2;
      const x = Math.cos(angle) * crownRadius;
      const z = Math.sin(angle) * crownRadius;
      addPart(group, GEOMETRY.headSmall, materials.accent, type, id, [x, 1.0, z], undefined, [
        0.4,
        0.4,
        0.4
      ]);
    }
  } else if (type === 'king') {
    addPart(group, GEOMETRY.baseLarge, materials.primary, type, id, [0, 0.075, 0]);
    addPart(group, GEOMETRY.bodyKing, materials.primary, type, id, [0, 0.575, 0]);
    addPart(group, GEOMETRY.headCylinder, materials.primary, type, id, [0, 1.1, 0]);
    addPart(group, GEOMETRY.kingCrossVertical, materials.accent, type, id, [0, 1.28, 0]);
    addPart(group, GEOMETRY.kingCrossHorizontal, materials.accent, type, id, [0, 1.24, 0]);
  }

  return group;
}
