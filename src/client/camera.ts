import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SnapView } from '../types';

export class CameraController {
  private controls: OrbitControls;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.controls = new OrbitControls(camera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 5.5;
    this.controls.maxDistance = 18;
    this.controls.minPolarAngle = 0.35;
    this.controls.maxPolarAngle = Math.PI / 2.05;
    this.controls.enablePan = false;
    this.controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE
    };
  }

  update(): void {
    this.controls.update();
  }

  handleKey(key: string): void {
    const step = 0.12;
    if (key === 'q') {
      this.controls.rotateLeft(step);
    } else if (key === 'e') {
      this.controls.rotateLeft(-step);
    } else if (key === 'r') {
      this.controls.rotateUp(step);
    } else if (key === 'f') {
      this.controls.rotateUp(-step);
    }
  }

  snap(view: SnapView): void {
    const radius = 10.5;
    const elevation = 6.5;
    const camera = this.controls.object as THREE.PerspectiveCamera;

    if (view === 'white') {
      camera.position.set(0, elevation, radius);
    } else if (view === 'black') {
      camera.position.set(0, elevation, -radius);
    } else {
      camera.position.set(radius * 0.7, elevation, radius * 0.7);
    }

    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }
}
