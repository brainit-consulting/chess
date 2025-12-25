import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SnapView } from '../types';

export class CameraController {
  private controls: OrbitControls;
  private camera: THREE.PerspectiveCamera;
  private baseTarget = new THREE.Vector3();
  private biasTarget = new THREE.Vector3();
  private biasCurrent = new THREE.Vector3();
  private baseFov: number;
  private baseDamping: number;
  private zoomFrom = 0;
  private zoomTo = 0;
  private zoomStart = 0;
  private zoomDuration = 240;
  private nudgeStart: number | null = null;
  private nudgeDuration = 220;
  private nudgeBasePosition = new THREE.Vector3();
  private nudgeDirection = new THREE.Vector3();
  private nudgeOffset = new THREE.Vector3();
  private settleStart: number | null = null;
  private settleDuration = 420;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;
    this.controls = new OrbitControls(camera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.baseDamping = this.controls.dampingFactor;
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
    this.baseTarget.copy(this.controls.target);
    this.baseFov = camera.fov;
    this.zoomFrom = camera.fov;
    this.zoomTo = camera.fov;
  }

  update(): void {
    // Apply subtle target bias before OrbitControls updates camera.
    this.applyTargetBias();
    this.applySettle();
    this.controls.update();
    // Ease UI zoom and turn nudge without snapping.
    this.applyUiZoom();
    this.applyNudge();
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
    const topRadius = 11;
    const topAngle = THREE.MathUtils.degToRad(15);
    const camera = this.controls.object as THREE.PerspectiveCamera;

    if (view === 'white') {
      camera.position.set(0, elevation, radius);
    } else if (view === 'black') {
      camera.position.set(0, elevation, -radius);
    } else if (view === 'top') {
      const height = Math.cos(topAngle) * topRadius;
      const offset = Math.sin(topAngle) * topRadius;
      camera.position.set(0, height, offset);
    } else {
      camera.position.set(radius * 0.7, elevation, radius * 0.7);
    }

    this.baseTarget.set(0, 0, 0);
    this.controls.target.copy(this.baseTarget).add(this.biasCurrent);
    this.controls.update();
  }

  setUiZoomedOut(zoomedOut: boolean): void {
    // Slight FOV lift when UI is hidden/collapsed.
    const targetFov = this.baseFov * (zoomedOut ? 1.08 : 1);
    if (Math.abs(targetFov - this.zoomTo) < 0.01) {
      return;
    }
    this.zoomFrom = this.camera.fov;
    this.zoomTo = targetFov;
    this.zoomStart = performance.now();
  }

  nudgeTurn(): void {
    // Gentle micro-nudge to acknowledge turn changes.
    this.nudgeBasePosition.copy(this.camera.position);
    this.nudgeDirection
      .copy(this.camera.position)
      .sub(this.controls.target)
      .normalize();
    this.nudgeStart = performance.now();
  }

  settleCheckmate(): void {
    // Briefly increase damping so the view feels like it settles.
    this.settleStart = performance.now();
  }

  setCheckTarget(target: THREE.Vector3 | null): void {
    // Softly bias the camera toward the checked king.
    if (!target) {
      this.biasTarget.set(0, 0, 0);
      return;
    }
    const offset = target.clone().sub(this.baseTarget);
    offset.y = 0;
    if (offset.lengthSq() < 0.0001) {
      this.biasTarget.set(0, 0, 0);
      return;
    }
    offset.normalize().multiplyScalar(0.35);
    this.biasTarget.copy(offset);
  }

  private applyTargetBias(): void {
    this.biasCurrent.lerp(this.biasTarget, 0.08);
    this.controls.target.copy(this.baseTarget).add(this.biasCurrent);
  }

  private applyUiZoom(): void {
    if (!this.zoomStart) {
      return;
    }
    const elapsed = performance.now() - this.zoomStart;
    const t = Math.min(elapsed / this.zoomDuration, 1);
    const eased = t * (2 - t);
    this.camera.fov = lerp(this.zoomFrom, this.zoomTo, eased);
    this.camera.updateProjectionMatrix();
    if (t >= 1) {
      this.zoomStart = 0;
    }
  }

  private applyNudge(): void {
    if (!this.nudgeStart) {
      return;
    }
    const elapsed = performance.now() - this.nudgeStart;
    const t = Math.min(elapsed / this.nudgeDuration, 1);
    const strength = Math.sin(Math.PI * t) * 0.08;
    this.nudgeOffset.copy(this.nudgeDirection).multiplyScalar(strength);
    this.camera.position.copy(this.nudgeBasePosition).add(this.nudgeOffset);
    if (t >= 1) {
      this.nudgeStart = null;
    }
  }

  private applySettle(): void {
    if (!this.settleStart) {
      if (this.controls.dampingFactor !== this.baseDamping) {
        this.controls.dampingFactor = this.baseDamping;
      }
      return;
    }
    const elapsed = performance.now() - this.settleStart;
    const t = Math.min(elapsed / this.settleDuration, 1);
    const eased = t * (2 - t);
    const peak = this.baseDamping + 0.08;
    this.controls.dampingFactor = lerp(peak, this.baseDamping, eased);
    if (t >= 1) {
      this.settleStart = null;
      this.controls.dampingFactor = this.baseDamping;
    }
  }
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}
