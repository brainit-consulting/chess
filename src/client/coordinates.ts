import * as THREE from 'three';
import { squareToWorld } from './boardMapping';

const FILE_LABELS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANK_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8'];
const LABEL_OFFSET = 0.62;
const LABEL_Y = 0.01;
const LABEL_SCALE = 0.32;

export type CoordinateOrientation = 'white' | 'black';

type CoordinateSprites = {
  fileSprites: THREE.Sprite[];
  rankSprites: THREE.Sprite[];
};

export function createCoordinateGroup(tileSize: number): THREE.Group {
  const group = new THREE.Group();
  const fileSprites: THREE.Sprite[] = [];
  const rankSprites: THREE.Sprite[] = [];

  for (let file = 0; file < 8; file += 1) {
    const sprite = createLabelSprite(FILE_LABELS[file]);
    sprite.position.set(
      (file - 3.5) * tileSize,
      LABEL_Y,
      (-3.5 - LABEL_OFFSET) * tileSize
    );
    fileSprites.push(sprite);
    group.add(sprite);
  }

  for (let rank = 0; rank < 8; rank += 1) {
    const sprite = createLabelSprite(RANK_LABELS[rank]);
    sprite.position.set(
      (-3.5 - LABEL_OFFSET) * tileSize,
      LABEL_Y,
      (rank - 3.5) * tileSize
    );
    rankSprites.push(sprite);
    group.add(sprite);
  }

  const data: CoordinateSprites = { fileSprites, rankSprites };
  group.userData.coordinates = data;
  group.userData.tileSize = tileSize;
  return group;
}

export function setCoordinateOrientation(
  group: THREE.Group,
  orientation: CoordinateOrientation
): void {
  const data = group.userData.coordinates as CoordinateSprites | undefined;
  if (!data) {
    return;
  }
  const tileSize = group.userData.tileSize as number | undefined;
  const size = tileSize ?? 1;
  const edgeOffset = LABEL_OFFSET * size;
  const a1 = squareToWorld({ file: 0, rank: 0 }, size, LABEL_Y);
  const b1 = squareToWorld({ file: 1, rank: 0 }, size, LABEL_Y);
  const a2 = squareToWorld({ file: 0, rank: 1 }, size, LABEL_Y);
  const a8 = squareToWorld({ file: 0, rank: 7 }, size, LABEL_Y);
  const h1 = squareToWorld({ file: 7, rank: 0 }, size, LABEL_Y);
  const fileDir = new THREE.Vector3(b1.x - a1.x, 0, b1.z - a1.z);
  const rankDir = new THREE.Vector3(a2.x - a1.x, 0, a2.z - a1.z);
  const fileUnit = fileDir.clone().normalize();
  const rankUnit = rankDir.clone().normalize();
  const bottomOffset = rankUnit.clone().multiplyScalar(
    orientation === 'black' ? edgeOffset : -edgeOffset
  );
  const leftOffset = fileUnit.clone().multiplyScalar(
    orientation === 'black' ? edgeOffset : -edgeOffset
  );
  const fileAnchor = orientation === 'black' ? a8 : a1;
  const rankAnchor = orientation === 'black' ? h1 : a1;

  data.fileSprites.forEach((sprite, index) => {
    updateLabelSprite(sprite, FILE_LABELS[index]);
    const base = {
      x: fileAnchor.x + fileDir.x * index,
      y: LABEL_Y,
      z: fileAnchor.z + fileDir.z * index
    };
    sprite.position.set(
      base.x + bottomOffset.x,
      LABEL_Y,
      base.z + bottomOffset.z
    );
  });
  data.rankSprites.forEach((sprite, index) => {
    updateLabelSprite(sprite, RANK_LABELS[index]);
    const base = {
      x: rankAnchor.x + rankDir.x * index,
      y: LABEL_Y,
      z: rankAnchor.z + rankDir.z * index
    };
    sprite.position.set(
      base.x + leftOffset.x,
      LABEL_Y,
      base.z + leftOffset.z
    );
  });
}

function createLabelSprite(text: string): THREE.Sprite {
  const texture = createLabelTexture(text);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: false
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(LABEL_SCALE, LABEL_SCALE, 1);
  sprite.renderOrder = 2;
  sprite.raycast = () => {};
  sprite.userData.label = text;
  return sprite;
}

function updateLabelSprite(sprite: THREE.Sprite, text: string): void {
  if (sprite.userData.label === text) {
    return;
  }
  sprite.userData.label = text;
  const material = sprite.material as THREE.SpriteMaterial;
  if (material.map) {
    material.map.dispose();
  }
  material.map = createLabelTexture(text);
  material.needsUpdate = true;
}

function createLabelTexture(text: string): THREE.Texture {
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    const size = 128;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, size, size);
      ctx.font = '600 52px "Trebuchet MS", "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(219, 204, 170, 0.7)';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 2;
      ctx.fillText(text, size / 2, size / 2 + 2);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
  }

  const data = new Uint8Array([255, 255, 255, 255]);
  const texture = new THREE.DataTexture(data, 1, 1);
  texture.needsUpdate = true;
  return texture;
}
