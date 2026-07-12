/**
 * Browser entry for the interactive viewer. Bundled by esbuild into a single
 * IIFE (three.js included) and inlined into the generated HTML, so the file
 * works offline, from file://, with no CDN and no install.
 *
 * The page carries one or more solved skeletons as JSON on
 * `window.ASANAKIT_VIEWER`; the figures come from the same scene builder the
 * GLB export uses. The viewer mounts into `#asanakit-3d` (fullscreen pages
 * just size that element to the window) and exposes
 * `window.ASANAKIT_SELECT(id)` so a showcase page can switch poses.
 */
import type {
  Group} from 'three';
import {
  AmbientLight,
  Color,
  DirectionalLight,
  GridHelper,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { MuscleId } from '../src/anatomy/muscles.js';
import type { CameraAngles } from '../src/core/camera.js';
import type { Skeleton } from '../src/core/types.js';
import { buildFigureScene } from '../src/three/scene.js';

interface ViewerPose {
  readonly id: string;
  readonly name: string;
  readonly sanskrit?: string;
  readonly skeleton: Skeleton;
  readonly engaged: readonly MuscleId[];
  readonly stretched: readonly MuscleId[];
}

interface ViewerPayload {
  readonly poses: readonly ViewerPose[];
  readonly camera: CameraAngles;
}

declare global {
  interface Window {
    ASANAKIT_VIEWER: ViewerPayload;
    ASANAKIT_SELECT: (id: string) => void;
  }
}

const DEG = Math.PI / 180;
const BACKGROUND = '#ffffff';
const DISTANCE = 2.3;

const payload = window.ASANAKIT_VIEWER;
const mount = document.getElementById('asanakit-3d');
if (mount === null) throw new Error('asanakit viewer: no #asanakit-3d element to mount into');

const scene = new Scene();
scene.background = new Color(BACKGROUND);

const grid = new GridHelper(2.4, 24, 0xd0d0d0, 0xe8e8e8);
scene.add(grid);

scene.add(new AmbientLight(0xffffff, 1.1));
const key = new DirectionalLight(0xffffff, 1.6);
key.position.set(1.5, 2.5, 2);
scene.add(key);
const fill = new DirectionalLight(0xffffff, 0.5);
fill.position.set(-2, 1, -1.5);
scene.add(fill);

const figures = new Map<string, Group>();
let current: Group | null = null;

const figureFor = (pose: ViewerPose): Group => {
  let group = figures.get(pose.id);
  if (group === undefined) {
    group = buildFigureScene(pose.skeleton, { engaged: pose.engaged, stretched: pose.stretched });
    figures.set(pose.id, group);
  }
  return group;
};

const camera = new PerspectiveCamera(40, 1, 0.01, 50);
const renderer = new WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
mount.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 0.3;
controls.maxDistance = 12;

const centreOf = (skeleton: Skeleton): [number, number, number] => {
  const b = skeleton.bounds;
  return [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, (b.minZ + b.maxZ) / 2];
};

const aimAt = (skeleton: Skeleton): void => {
  const [cx, cy, cz] = centreOf(skeleton);
  const az = payload.camera.azimuth * DEG;
  const el = payload.camera.elevation * DEG;
  camera.position.set(
    cx + DISTANCE * Math.sin(az) * Math.cos(el),
    cy + DISTANCE * Math.sin(el),
    cz + DISTANCE * Math.cos(az) * Math.cos(el),
  );
  controls.target.set(cx, cy, cz);
  controls.update();
};

const select = (id: string): void => {
  const pose = payload.poses.find((p) => p.id === id) ?? payload.poses[0];
  if (pose === undefined) return;
  if (current !== null) scene.remove(current);
  current = figureFor(pose);
  scene.add(current);

  // Keep the user's orbit direction, but glide the pivot to the new figure.
  const [cx, cy, cz] = centreOf(pose.skeleton);
  camera.position.add(new Vector3(cx - controls.target.x, cy - controls.target.y, cz - controls.target.z));
  controls.target.set(cx, cy, cz);
  controls.update();

  document.querySelectorAll('[data-asanakit-pose]').forEach((button) => {
    button.classList.toggle('active', button.getAttribute('data-asanakit-pose') === pose.id);
  });
};

window.ASANAKIT_SELECT = select;

const resize = (): void => {
  const width = Math.max(mount.clientWidth, 1);
  const height = Math.max(mount.clientHeight, 1);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
};

new ResizeObserver(resize).observe(mount);
resize();

const first = payload.poses[0];
if (first !== undefined) {
  select(first.id);
  aimAt(first.skeleton);
}

renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});
