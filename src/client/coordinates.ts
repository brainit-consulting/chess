import * as THREE from 'three';

const FILE_LABELS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANK_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8'];
const LABEL_OFFSET = 0.62;
const LABEL_Y = 0.01;
const LABEL_SCALE = 0.32;

export function createCoordinateGroup(tileSize: number): THREE.Group {
  const group = new THREE.Group();

  for (let file = 0; file < 8; file += 1) {
    const sprite = createLabelSprite(FILE_LABELS[file]);
    sprite.position.set(
      (file - 3.5) * tileSize,
      LABEL_Y,
      (-3.5 - LABEL_OFFSET) * tileSize
    );
    group.add(sprite);
  }

  for (let rank = 0; rank < 8; rank += 1) {
    const sprite = createLabelSprite(RANK_LABELS[rank]);
    sprite.position.set(
      (-3.5 - LABEL_OFFSET) * tileSize,
      LABEL_Y,
      (rank - 3.5) * tileSize
    );
    group.add(sprite);
  }

  return group;
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
  return sprite;
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
