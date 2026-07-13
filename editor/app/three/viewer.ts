import type { Group, Mesh, MeshStandardMaterial } from 'three';
import { AmbientLight, Color, DirectionalLight, GridHelper, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { MuscleId } from '@asanakit/anatomy/muscles.js';
import type { CameraAngles } from '@asanakit/core/camera.js';
import type { BoneId, Skeleton } from '@asanakit/core/types.js';
import type { Prop } from '@asanakit/model/schema.js';
import { buildFigureScene } from '@asanakit/three/scene.js';
import { aimFromPointer, boneOfMesh, jointOfMesh, pickBone, type AimAngles } from './pick.js';

export interface ViewerCallbacks {
  /** A bone was tapped (null: empty space, clears the selection). */
  readonly onSelect?: (bone: BoneId | null) => void;
  /** A bone tip is being dragged toward a new world direction; fires while the finger moves. */
  readonly onAim?: (bone: BoneId, angles: AimAngles) => void;
  /** The aim gesture ended - close the undo step. */
  readonly onAimEnd?: () => void;
  /** The orbit moved. There is one camera in this app, and this is how it gets written. */
  readonly onOrbit?: (angles: { azimuth: number; elevation: number }) => void;
  /** The orbit gesture ended - close the undo step. */
  readonly onOrbitEnd?: () => void;
}

export interface ViewerHandle {
  setFigure(skeleton: Skeleton, engaged: readonly MuscleId[], stretched: readonly MuscleId[], props: readonly Prop[]): void;
  setSelected(bone: BoneId | null): void;
  /** The orbit camera's current angles, in the render camera's orbit convention. */
  getAngles(): { azimuth: number; elevation: number };
  /** Drive the orbit FROM the document - the other half of "one camera". */
  setAngles(angles: { azimuth: number; elevation: number }): void;
  /**
   * Roll the picture. OrbitControls owns `camera.up`, so rolling the camera
   * there would break its own azimuth/polar maths; rotating the image plane
   * about the view axis is the same thing and costs nothing.
   */
  setRoll(degrees: number): void;
  dispose(): void;
}

const ACCENT = new Color('#3b49b4');
const DRAG_THRESHOLD_PX = 6;
const DEG = 180 / Math.PI;
const RAD = Math.PI / 180;
const TARGET = new Vector3(0, 0.5, 0);
const ORBIT_RADIUS = 2.4;
/** How close the orbit may get to a pole before its azimuth stops meaning anything. */
const POLE_EPSILON = 0.01;

interface DragState {
  readonly bone: BoneId;
  readonly pivot: Vector3;
  readonly planePoint: Vector3;
  readonly startX: number;
  readonly startY: number;
  moved: boolean;
}

/**
 * One long-lived orbitable scene; the figure group swaps on every edit.
 * Touch a bone to select it, drag it to aim the limb; empty space orbits.
 */
export const createViewer = (mount: HTMLElement, callbacks: ViewerCallbacks = {}, initial?: CameraAngles): ViewerHandle => {
  const scene = new Scene();
  scene.background = new Color('#ffffff');

  const camera = new PerspectiveCamera(38, 1, 0.01, 100);
  const azimuth = (initial?.azimuth ?? 22) * RAD;
  const polar = (90 - (initial?.elevation ?? 18)) * RAD;
  camera.position
    .setFromSphericalCoords(ORBIT_RADIUS, polar, azimuth)
    .add(TARGET);

  scene.add(new AmbientLight(0xffffff, 1.15));
  const sun = new DirectionalLight(0xffffff, 1.6);
  sun.position.set(2, 4, 3);
  scene.add(sun);

  const grid = new GridHelper(4, 40, 0xd8d4ca, 0xeceae3);
  scene.add(grid);

  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.domElement.style.touchAction = 'none';
  mount.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(TARGET);
  // No damping: the orbit IS the document's camera, and a camera that keeps
  // drifting after the finger lifts would keep rewriting the pose after the
  // undo step has closed.
  controls.enableDamping = false;
  controls.maxDistance = 8;
  controls.minDistance = 0.4;

  let figure: Group | null = null;
  let skeleton: Skeleton | null = null;
  let selected: BoneId | null = null;
  let drag: DragState | null = null;
  let disposed = false;
  /** True while the document is driving the orbit, so we do not echo it straight back. */
  let applying = false;
  const originals = new Map<Mesh, MeshStandardMaterial>();

  const currentAngles = (): { azimuth: number; elevation: number } => ({
    azimuth: Math.round(controls.getAzimuthalAngle() * DEG),
    elevation: Math.round(90 - controls.getPolarAngle() * DEG),
  });

  controls.addEventListener('change', () => {
    if (applying) return;
    callbacks.onOrbit?.(currentAngles());
  });
  controls.addEventListener('end', () => {
    if (applying) return;
    callbacks.onOrbitEnd?.();
  });

  const clearHighlight = (): void => {
    for (const [mesh, material] of originals) mesh.material = material;
    originals.clear();
  };

  const applyHighlight = (): void => {
    clearHighlight();
    if (figure === null || selected === null) return;
    for (const child of figure.children) {
      const mesh = child as Mesh;
      // The bone AND the joint at the end of it: the handle you are holding lights
      // up along with the thing it moves.
      if (boneOfMesh(mesh) !== selected && jointOfMesh(mesh) !== selected) continue;
      const material = mesh.material as MeshStandardMaterial;
      originals.set(mesh, material);
      const lit = material.clone();
      lit.color.copy(ACCENT);
      lit.emissive.copy(ACCENT);
      lit.emissiveIntensity = 0.3;
      mesh.material = lit;
    }
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (figure === null || skeleton === null || !event.isPrimary) return;
    const rect = renderer.domElement.getBoundingClientRect();
    const bone = pickBone(event.clientX, event.clientY, { rect, camera, figure });
    if (bone === null) {
      // Empty space: OrbitControls owns the gesture; a plain tap clears the selection.
      if (selected !== null) callbacks.onSelect?.(null);
      return;
    }
    const segment = skeleton.bones[bone];
    drag = {
      bone,
      pivot: new Vector3(...segment.start),
      planePoint: new Vector3(...segment.end),
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    controls.enabled = false;
    renderer.domElement.setPointerCapture(event.pointerId);
    callbacks.onSelect?.(bone);
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (drag === null || figure === null || !event.isPrimary) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < DRAG_THRESHOLD_PX) return;
    drag.moved = true;
    const rect = renderer.domElement.getBoundingClientRect();
    const angles = aimFromPointer(event.clientX, event.clientY, { rect, camera, figure }, drag);
    if (angles !== null) callbacks.onAim?.(drag.bone, angles);
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (drag === null || !event.isPrimary) return;
    if (drag.moved) callbacks.onAimEnd?.();
    drag = null;
    controls.enabled = true;
  };

  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerup', onPointerUp);
  renderer.domElement.addEventListener('pointercancel', onPointerUp);

  const resize = (): void => {
    const { clientWidth, clientHeight } = mount;
    if (clientWidth === 0 || clientHeight === 0) return;
    renderer.setSize(clientWidth, clientHeight);
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(mount);
  resize();

  const tick = (): void => {
    if (disposed) return;
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  return {
    setFigure(nextSkeleton, engaged, stretched, props): void {
      if (figure !== null) scene.remove(figure);
      originals.clear();
      skeleton = nextSkeleton;
      figure = buildFigureScene(nextSkeleton, { engaged: [...engaged], stretched: [...stretched], props: [...props] });
      scene.add(figure);
      applyHighlight();
    },
    setSelected(bone): void {
      selected = bone;
      applyHighlight();
    },
    getAngles: currentAngles,
    setAngles({ azimuth, elevation }): void {
      applying = true;
      // Straight up and straight down are gimbal poles for an orbit: the camera's
      // own up-vector becomes its view direction and the azimuth stops meaning
      // anything. The 2D drawing wants an honest 90 (it is a plan view, and it
      // prints), so the pose keeps 90 - and only the orbit is nudged off it.
      const polar = Math.max(POLE_EPSILON, Math.min(Math.PI - POLE_EPSILON, (90 - elevation) * RAD));
      camera.position
        .setFromSphericalCoords(camera.position.distanceTo(controls.target), polar, azimuth * RAD)
        .add(controls.target);
      controls.update();
      applying = false;
    },
    setRoll(degrees): void {
      const r = Math.abs(degrees % 180) * RAD;
      // Grow the canvas enough that its corners never swing into view.
      const cover = Math.abs(Math.cos(r)) + Math.abs(Math.sin(r));
      renderer.domElement.style.transform = `rotate(${-degrees}deg) scale(${cover.toFixed(4)})`;
    },
    dispose(): void {
      disposed = true;
      observer.disconnect();
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
};
