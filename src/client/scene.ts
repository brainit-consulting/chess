import * as THREE from 'three';
import { CameraController } from './camera';
import {
  Color,
  GameState,
  Move,
  PieceType,
  Square,
  getPieceSquares
} from '../rules';
import { SnapView } from '../types';

export type PickResult = {
  type: 'square' | 'piece';
  square: Square;
  pieceId?: number;
};

type HighlightState = {
  selected: Square | null;
  legalMoves: Move[];
  lastMove: Move | null;
  checkSquare: Square | null;
};

type SceneHandlers = {
  onPick: (pick: PickResult) => void;
  onCancel: () => void;
};

const TILE_SIZE = 1;

export class SceneView {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private cameraController: CameraController;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private boardGroup = new THREE.Group();
  private piecesGroup = new THREE.Group();
  private markersGroup = new THREE.Group();
  private squareMeshes: THREE.Mesh[][] = [];
  private pieceMeshes = new Map<number, THREE.Mesh>();
  private handlers: SceneHandlers;
  private pointerDown: { x: number; y: number; button: number } | null = null;

  constructor(container: HTMLElement, handlers: SceneHandlers) {
    this.handlers = handlers;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0b0d12');

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    this.camera.position.set(0, 6.5, 10.5);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.domElement.style.touchAction = 'none';
    container.appendChild(this.renderer.domElement);

    this.cameraController = new CameraController(this.camera, this.renderer.domElement);

    this.scene.add(this.boardGroup);
    this.scene.add(this.piecesGroup);
    this.scene.add(this.markersGroup);

    this.addLights();
    this.buildBoard();

    window.addEventListener('resize', () => this.handleResize(container));
    window.addEventListener('keydown', (event) => this.cameraController.handleKey(event.key));

    this.renderer.domElement.addEventListener('pointerdown', (event) => {
      this.pointerDown = { x: event.clientX, y: event.clientY, button: event.button };
    });

    this.renderer.domElement.addEventListener('pointerup', (event) => {
      if (!this.pointerDown || event.button !== 0) {
        return;
      }

      const dx = Math.abs(event.clientX - this.pointerDown.x);
      const dy = Math.abs(event.clientY - this.pointerDown.y);
      this.pointerDown = null;

      if (dx + dy > 6) {
        return;
      }

      this.handlePick(event);
    });

    this.renderer.domElement.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      this.handlers.onCancel();
    });

    this.animate();
  }

  setState(state: GameState): void {
    const positions = getPieceSquares(state);
    const seen = new Set<number>();

    for (const [id, piece] of state.pieces) {
      const square = positions.get(id);
      if (!square) {
        continue;
      }

      const existing = this.pieceMeshes.get(id);
      if (existing && existing.userData.type !== piece.type) {
        this.piecesGroup.remove(existing);
        this.pieceMeshes.delete(id);
      }

      const mesh = this.pieceMeshes.get(id) || this.createPieceMesh(piece.type, piece.color, id);
      mesh.position.copy(this.squareToWorld(square));
      mesh.userData.square = square;
      seen.add(id);
    }

    for (const [id, mesh] of this.pieceMeshes) {
      if (!seen.has(id)) {
        this.piecesGroup.remove(mesh);
        this.pieceMeshes.delete(id);
      }
    }
  }

  setHighlights(highlights: HighlightState): void {
    this.resetSquareColors();
    this.markersGroup.clear();

    if (highlights.lastMove) {
      this.tintSquare(highlights.lastMove.from, '#a0782f');
      this.tintSquare(highlights.lastMove.to, '#a0782f');
    }

    if (highlights.selected) {
      this.tintSquare(highlights.selected, '#3d5d91');
    }

    if (highlights.checkSquare) {
      this.tintSquare(highlights.checkSquare, '#8f2f2f');
    }

    for (const move of highlights.legalMoves) {
      const isCapture = move.capturedId !== undefined || move.isEnPassant;
      this.markersGroup.add(this.createMarker(move.to, isCapture));
    }
  }

  snapView(view: SnapView): void {
    this.cameraController.snap(view);
  }

  private handleResize(container: HTMLElement): void {
    const width = container.clientWidth;
    const height = container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private handlePick(event: PointerEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const intersects = this.raycaster.intersectObjects(
      [this.piecesGroup, this.boardGroup],
      true
    );

    const hit = intersects.find((item) => item.object.userData.pickType);
    if (!hit) {
      return;
    }

    const { pickType, square, pieceId } = hit.object.userData as {
      pickType: 'square' | 'piece';
      square: Square;
      pieceId?: number;
    };

    if (!square) {
      return;
    }

    this.handlers.onPick({
      type: pickType,
      square,
      pieceId
    });
  }

  private addLights(): void {
    const ambient = new THREE.AmbientLight('#ffffff', 0.6);
    const directional = new THREE.DirectionalLight('#ffffff', 0.7);
    directional.position.set(6, 8, 6);
    this.scene.add(ambient, directional);
  }

  private buildBoard(): void {
    const light = new THREE.MeshStandardMaterial({ color: '#e3d9c7' });
    const dark = new THREE.MeshStandardMaterial({ color: '#7b6b5a' });

    for (let rank = 0; rank < 8; rank += 1) {
      const row: THREE.Mesh[] = [];
      for (let file = 0; file < 8; file += 1) {
        const isDark = (file + rank) % 2 === 1;
        const material = isDark ? dark.clone() : light.clone();
        const geometry = new THREE.BoxGeometry(TILE_SIZE, 0.1, TILE_SIZE);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(
          (file - 3.5) * TILE_SIZE,
          -0.05,
          (rank - 3.5) * TILE_SIZE
        );
        mesh.userData = {
          pickType: 'square',
          square: { file, rank },
          baseColor: material.color.clone()
        };
        row.push(mesh);
        this.boardGroup.add(mesh);
      }
      this.squareMeshes.push(row);
    }
  }

  private resetSquareColors(): void {
    for (const row of this.squareMeshes) {
      for (const mesh of row) {
        const baseColor = mesh.userData.baseColor as THREE.Color;
        (mesh.material as THREE.MeshStandardMaterial).color.copy(baseColor);
      }
    }
  }

  private tintSquare(square: Square, color: string): void {
    const mesh = this.squareMeshes[square.rank]?.[square.file];
    if (!mesh) {
      return;
    }
    (mesh.material as THREE.MeshStandardMaterial).color.set(color);
  }

  private squareToWorld(square: Square): THREE.Vector3 {
    return new THREE.Vector3(
      (square.file - 3.5) * TILE_SIZE,
      0.02,
      (square.rank - 3.5) * TILE_SIZE
    );
  }

  private createPieceMesh(type: PieceType, color: Color, id: number): THREE.Mesh {
    const material = new THREE.MeshStandardMaterial({
      color: color === 'w' ? '#f3f0e7' : '#1b1b1d'
    });

    let geometry: THREE.BufferGeometry;
    if (type === 'pawn') {
      geometry = new THREE.CylinderGeometry(0.25, 0.3, 0.6, 16);
    } else if (type === 'rook') {
      geometry = new THREE.BoxGeometry(0.55, 0.6, 0.55);
    } else if (type === 'knight') {
      geometry = new THREE.ConeGeometry(0.35, 0.8, 16);
    } else if (type === 'bishop') {
      geometry = new THREE.CylinderGeometry(0.22, 0.35, 0.9, 16);
    } else if (type === 'queen') {
      geometry = new THREE.CylinderGeometry(0.28, 0.38, 1.1, 18);
    } else {
      geometry = new THREE.CylinderGeometry(0.3, 0.4, 1.2, 18);
    }

    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    if (box) {
      geometry.translate(0, -box.min.y, 0);
    }

    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData = {
      pickType: 'piece',
      pieceId: id,
      type
    };
    this.piecesGroup.add(mesh);
    this.pieceMeshes.set(id, mesh);
    return mesh;
  }

  private createMarker(square: Square, isCapture: boolean): THREE.Mesh {
    const geometry = isCapture
      ? new THREE.RingGeometry(0.22, 0.3, 24)
      : new THREE.CircleGeometry(0.15, 18);
    const material = new THREE.MeshBasicMaterial({
      color: isCapture ? '#e06d6d' : '#86c48a',
      transparent: true,
      opacity: 0.85
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(this.squareToWorld(square));
    mesh.position.y += 0.02;
    return mesh;
  }

  private animate(): void {
    requestAnimationFrame(() => this.animate());
    this.cameraController.update();
    this.renderer.render(this.scene, this.camera);
  }
}
