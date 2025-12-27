import * as THREE from 'three';
import { CameraController } from './camera';
import { Color, GameState, Move, PieceType, Square, getPieceSquares } from '../rules';
import { CoordinateMode, PieceSet, SnapView } from '../types';
import { createSciFiPieceInstance, preloadSciFiModels } from './models/scifiChessModels';
import { createStandardPieceInstance, preloadStandardModels } from './models/standardChessModels';
import { createCoordinateGroup, setCoordinateOrientation } from './coordinates';
import { isDarkSquare, squareToWorld as mapSquareToWorld } from './boardMapping';

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
  hintMove: Move | null;
};

type SceneHandlers = {
  onPick: (pick: PickResult) => void;
  onCancel: () => void;
};

type PieceSetProvider = {
  preload: () => Promise<void>;
  createPieceInstance: (type: PieceType, color: Color, id: number) => THREE.Object3D;
};

const PIECE_SET_PROVIDERS: Record<PieceSet, PieceSetProvider> = {
  scifi: {
    preload: preloadSciFiModels,
    createPieceInstance: createSciFiPieceInstance
  },
  standard: {
    preload: preloadStandardModels,
    createPieceInstance: createStandardPieceInstance
  }
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
  private pieceMeshes = new Map<number, THREE.Object3D>();
  private handlers: SceneHandlers;
  private pointerDown: { x: number; y: number; button: number } | null = null;
  private modelsReady = false;
  private pendingState: GameState | null = null;
  private readyPromise: Promise<void>;
  private checkHalo: THREE.Mesh | null = null;
  private hintFrom: THREE.Mesh | null = null;
  private hintTo: THREE.Mesh | null = null;
  private pieceSet: PieceSet;
  private pieceProvider: PieceSetProvider;
  private lastState: GameState | null = null;
  private coordinateGroup: THREE.Group;
  private coordinateMode: CoordinateMode = 'fixed-white';
  private mappingValidated = false;
  private debugOverlay: THREE.Group | null = null;
  private debugEnabled = false;

  constructor(container: HTMLElement, handlers: SceneHandlers, pieceSet: PieceSet = 'scifi') {
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
    this.coordinateGroup = createCoordinateGroup(TILE_SIZE);
    this.applyCoordinateOrientation();
    this.boardGroup.add(this.coordinateGroup);

    this.addLights();
    this.buildBoard();

    this.pieceSet = pieceSet;
    this.pieceProvider = PIECE_SET_PROVIDERS[this.pieceSet];
    this.readyPromise = this.loadPieceSet(this.pieceSet);
    this.debugEnabled = import.meta.env.DEV && this.readDebugFlag();

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
    this.lastState = state;
    if (!this.modelsReady) {
      this.pendingState = state;
      return;
    }
    this.applyState(state);
  }

  ready(): Promise<void> {
    return this.readyPromise;
  }

  setPieceSet(pieceSet: PieceSet): Promise<void> {
    if (this.pieceSet === pieceSet) {
      return this.readyPromise;
    }
    this.pieceSet = pieceSet;
    this.pieceProvider = PIECE_SET_PROVIDERS[pieceSet];
    this.modelsReady = false;
    this.pendingState = this.lastState;
    this.readyPromise = this.loadPieceSet(pieceSet, true);
    return this.readyPromise;
  }

  private loadPieceSet(pieceSet: PieceSet, rebuild = false): Promise<void> {
    const provider = PIECE_SET_PROVIDERS[pieceSet];
    return provider.preload().then(() => {
      this.modelsReady = true;
      if (rebuild) {
        this.clearPieces();
      }
      if (this.pendingState) {
        this.applyState(this.pendingState);
        this.pendingState = null;
      }
    });
  }

  private applyState(state: GameState): void {
    this.validateBoardMapping(state);
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

      let object = this.pieceMeshes.get(id);
      if (!object) {
        object = this.pieceProvider.createPieceInstance(piece.type, piece.color, id);
        this.piecesGroup.add(object);
        this.pieceMeshes.set(id, object);
      }
      object.position.copy(this.squareToWorld(square));
      this.setPieceSquare(object, square);
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
      this.updateCheckHalo(highlights.checkSquare);
      const world = this.squareToWorld(highlights.checkSquare);
      world.y = 0;
      this.cameraController.setCheckTarget(world);
    } else {
      this.clearCheckHalo();
      this.cameraController.setCheckTarget(null);
    }

    for (const move of highlights.legalMoves) {
      const isCapture = move.capturedId !== undefined || move.isEnPassant;
      this.markersGroup.add(this.createMarker(move.to, isCapture));
    }

    this.updateHintMarkers(highlights.hintMove);
  }

  setHintMove(move: Move | null): void {
    this.updateHintMarkers(move);
  }

  snapView(view: SnapView): void {
    this.cameraController.snap(view);
    this.applyCoordinateOrientation();
  }

  setUiState(state: { visible: boolean; collapsed: boolean; historyVisible: boolean }): void {
    this.cameraController.setUiZoomedOut(
      !state.visible || state.collapsed || !state.historyVisible
    );
  }

  setCoordinateMode(mode: CoordinateMode): void {
    this.coordinateMode = mode;
    this.applyCoordinateOrientation();
  }

  nudgeTurnChange(): void {
    this.cameraController.nudgeTurn();
  }

  settleCheckmate(): void {
    this.cameraController.settleCheckmate();
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
    // Soft rim light to separate silhouettes without flattening form.
    const rim = new THREE.DirectionalLight('#b7c7ff', 0.25);
    rim.position.set(-6, 7, -5);
    this.scene.add(ambient, directional, rim);
  }

  private buildBoard(): void {
    const light = new THREE.MeshStandardMaterial({
      color: '#dcc1a0',
      roughness: 0.78,
      metalness: 0.12
    });
    const dark = new THREE.MeshStandardMaterial({
      color: '#7a4a2e',
      roughness: 0.82,
      metalness: 0.14
    });

    for (let rank = 0; rank < 8; rank += 1) {
      const row: THREE.Mesh[] = [];
      for (let file = 0; file < 8; file += 1) {
        const isDark = isDarkSquare(file, rank);
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
    const pos = mapSquareToWorld(square, TILE_SIZE);
    return new THREE.Vector3(pos.x, pos.y, pos.z);
  }

  private updateCheckHalo(square: Square): void {
    const target = this.findPieceAtSquare(square);
    if (!target) {
      this.clearCheckHalo();
      return;
    }

    if (!this.checkHalo) {
      const geometry = new THREE.TorusGeometry(0.38, 0.05, 12, 32);
      const material = new THREE.MeshBasicMaterial({
        color: '#e05a5a',
        transparent: true,
        opacity: 0.7
      });
      this.checkHalo = new THREE.Mesh(geometry, material);
      this.checkHalo.rotation.x = Math.PI / 2;
      this.markersGroup.add(this.checkHalo);
    }

    this.checkHalo.position.copy(target.object.position);
    this.checkHalo.position.y += 0.75;
  }

  private clearCheckHalo(): void {
    if (this.checkHalo) {
      this.markersGroup.remove(this.checkHalo);
      this.checkHalo.geometry.dispose();
      (this.checkHalo.material as THREE.Material).dispose();
      this.checkHalo = null;
    }
  }

  private updateHintMarkers(move: Move | null): void {
    if (!move) {
      this.clearHintMarkers();
      return;
    }

    if (!this.hintFrom || !this.hintTo) {
      const fromMaterial = new THREE.MeshBasicMaterial({
        color: '#6fa6ff',
        transparent: true,
        opacity: 0.55
      });
      const toMaterial = new THREE.MeshBasicMaterial({
        color: '#89d98a',
        transparent: true,
        opacity: 0.55
      });
      const geometry = new THREE.RingGeometry(0.34, 0.42, 24);
      this.hintFrom = new THREE.Mesh(geometry, fromMaterial);
      this.hintTo = new THREE.Mesh(geometry, toMaterial);
      this.hintFrom.rotation.x = -Math.PI / 2;
      this.hintTo.rotation.x = -Math.PI / 2;
    }

    this.hintFrom.position.copy(this.squareToWorld(move.from));
    this.hintTo.position.copy(this.squareToWorld(move.to));
    this.hintFrom.position.y += 0.02;
    this.hintTo.position.y += 0.02;

    this.markersGroup.add(this.hintFrom, this.hintTo);
  }

  private clearHintMarkers(): void {
    if (this.hintFrom) {
      this.markersGroup.remove(this.hintFrom);
      this.hintFrom.geometry.dispose();
      (this.hintFrom.material as THREE.Material).dispose();
      this.hintFrom = null;
    }
    if (this.hintTo) {
      this.markersGroup.remove(this.hintTo);
      this.hintTo.geometry.dispose();
      (this.hintTo.material as THREE.Material).dispose();
      this.hintTo = null;
    }
  }

  private clearPieces(): void {
    for (const mesh of this.pieceMeshes.values()) {
      this.piecesGroup.remove(mesh);
    }
    this.pieceMeshes.clear();
  }

  private findPieceAtSquare(
    square: Square
  ): { id: number; object: THREE.Object3D } | null {
    for (const [id, object] of this.pieceMeshes) {
      const pieceSquare = object.userData.square as Square | undefined;
      if (pieceSquare && pieceSquare.file === square.file && pieceSquare.rank === square.rank) {
        return { id, object };
      }
    }
    return null;
  }

  private setPieceSquare(object: THREE.Object3D, square: Square): void {
    object.userData.square = square;
    object.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.userData.square = square;
      }
    });
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
    if (this.checkHalo) {
      const t = performance.now() * 0.004;
      const pulse = 0.85 + Math.sin(t) * 0.15;
      this.checkHalo.scale.set(pulse, pulse, pulse);
      const material = this.checkHalo.material as THREE.MeshBasicMaterial;
      material.opacity = 0.45 + Math.sin(t) * 0.15;
    }
    if (this.hintFrom || this.hintTo) {
      const t = performance.now() * 0.003;
      const pulse = 0.9 + Math.sin(t) * 0.1;
      if (this.hintFrom) {
        this.hintFrom.scale.set(pulse, pulse, pulse);
      }
      if (this.hintTo) {
        this.hintTo.scale.set(pulse, pulse, pulse);
      }
    }
    this.renderer.render(this.scene, this.camera);
  }

  private applyCoordinateOrientation(): void {
    if (this.coordinateMode === 'hidden') {
      this.coordinateGroup.visible = false;
      return;
    }
    this.coordinateGroup.visible = true;
    const orientation = this.coordinateMode === 'fixed-black' ? 'black' : 'white';
    setCoordinateOrientation(this.coordinateGroup, orientation);
  }

  private validateBoardMapping(state: GameState): void {
    if (this.mappingValidated || !import.meta.env.DEV) {
      return;
    }
    this.mappingValidated = true;
    const errors: string[] = [];

    const a1 = { file: 0, rank: 0 };
    const d1 = { file: 3, rank: 0 };
    const e1 = { file: 4, rank: 0 };
    const d8 = { file: 3, rank: 7 };
    const e8 = { file: 4, rank: 7 };

    if (!isDarkSquare(a1.file, a1.rank)) {
      errors.push('a1 should be dark.');
    }
    if (isDarkSquare(d1.file, d1.rank)) {
      errors.push('d1 should be light.');
    }
    if (!isDarkSquare(e1.file, e1.rank)) {
      errors.push('e1 should be dark.');
    }
    if (!isDarkSquare(d8.file, d8.rank)) {
      errors.push('d8 should be dark.');
    }

    const whiteQueenId = state.board[d1.rank]?.[d1.file];
    const whiteKingId = state.board[e1.rank]?.[e1.file];
    const blackQueenId = state.board[d8.rank]?.[d8.file];
    const blackKingId = state.board[e8.rank]?.[e8.file];
    const whiteQueen = whiteQueenId ? state.pieces.get(whiteQueenId) : null;
    const whiteKing = whiteKingId ? state.pieces.get(whiteKingId) : null;
    const blackQueen = blackQueenId ? state.pieces.get(blackQueenId) : null;
    const blackKing = blackKingId ? state.pieces.get(blackKingId) : null;

    if (!whiteQueen || whiteQueen.type !== 'queen' || whiteQueen.color !== 'w') {
      errors.push('White queen should be on d1.');
    }
    if (!whiteKing || whiteKing.type !== 'king' || whiteKing.color !== 'w') {
      errors.push('White king should be on e1.');
    }
    if (!blackQueen || blackQueen.type !== 'queen' || blackQueen.color !== 'b') {
      errors.push('Black queen should be on d8.');
    }
    if (!blackKing || blackKing.type !== 'king' || blackKing.color !== 'b') {
      errors.push('Black king should be on e8.');
    }

    const colorLabel = (square: Square): string =>
      isDarkSquare(square.file, square.rank) ? 'dark' : 'light';
    const worldLabel = (square: Square): string => {
      const pos = mapSquareToWorld(square, TILE_SIZE);
      return `(${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`;
    };

    console.info(
      '[BoardMapping] a1:',
      colorLabel(a1),
      'world',
      worldLabel(a1)
    );
    console.info(
      '[BoardMapping] d1:',
      colorLabel(d1),
      'world',
      worldLabel(d1)
    );
    console.info(
      '[BoardMapping] d8:',
      colorLabel(d8),
      'world',
      worldLabel(d8)
    );
    console.info(
      '[BoardMapping] White queen:',
      whiteQueen ? 'd1' : 'missing',
      `(${colorLabel(d1)})`
    );
    console.info(
      '[BoardMapping] White king:',
      whiteKing ? 'e1' : 'missing',
      `(${colorLabel(e1)})`
    );
    console.info(
      '[BoardMapping] Black queen:',
      blackQueen ? 'd8' : 'missing',
      `(${colorLabel(d8)})`
    );
    console.info(
      '[BoardMapping] Black king:',
      blackKing ? 'e8' : 'missing',
      `(${colorLabel(e8)})`
    );

    if (errors.length) {
      console.warn('[BoardMapping] Invariant check failed:', errors);
      return;
    }

    if (this.debugEnabled) {
      this.showDebugOverlay();
    }
  }

  private showDebugOverlay(): void {
    if (this.debugOverlay) {
      return;
    }
    const group = new THREE.Group();
    group.add(this.createDebugLabel('a1 dark', { file: 0, rank: 0 }));
    group.add(this.createDebugLabel('d1 WQ', { file: 3, rank: 0 }));
    group.add(this.createDebugLabel('e1 WK', { file: 4, rank: 0 }));
    group.add(this.createDebugLabel('d8 BQ', { file: 3, rank: 7 }));
    this.scene.add(group);
    this.debugOverlay = group;
  }

  private createDebugLabel(text: string, square: Square): THREE.Sprite {
    const texture = this.createDebugTexture(text);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      depthTest: false
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(0.9, 0.9, 1);
    const pos = this.squareToWorld(square);
    sprite.position.set(pos.x, 0.25, pos.z);
    sprite.renderOrder = 3;
    return sprite;
  }

  private createDebugTexture(text: string): THREE.Texture {
    const canvas = document.createElement('canvas');
    const size = 128;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, size, size);
      ctx.font = '700 36px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255, 216, 128, 0.9)';
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.lineWidth = 6;
      ctx.strokeText(text, size / 2, size / 2);
      ctx.fillText(text, size / 2, size / 2);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
  }

  private readDebugFlag(): boolean {
    try {
      return localStorage.getItem('chess.debugCoordinates') === 'true';
    } catch {
      return false;
    }
  }
}
