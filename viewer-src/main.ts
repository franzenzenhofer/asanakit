/**
 * Browser entry for the interactive viewer. Bundled by esbuild into a single
 * IIFE (three.js included) and inlined into the generated HTML, so the file
 * works offline, from file://, with no CDN and no install.
 *
 * The page carries the solved skeleton as JSON on `window.ASANAKIT_VIEWER`;
 * the figure itself comes from the same scene builder the GLB export uses.
 */
import {
  AmbientLight,
  Color,
  DirectionalLight,
  GridHelper,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { MuscleId } from '../src/anatomy/muscles.js';
import type { CameraAngles } from '../src/core/camera.js';
import type { Skeleton } from '../src/core/types.js';
import { buildFigureScene } from '../src/three/scene.js';

interface ViewerPayload {
  readonly skeleton: Skeleton;
  readonly camera: CameraAngles;
  readonly engaged: readonly MuscleId[];
  readonly stretched: readonly MuscleId[];
}

declare global {
  interface Window {
    ASANAKIT_VIEWER: ViewerPayload;
  }
}

const DEG = Math.PI / 180;
const BACKGROUND = '#ffffff';
const DISTANCE = 2.3;

const payload = window.ASANAKIT_VIEWER;

const scene = new Scene();
scene.background = new Color(BACKGROUND);

scene.add(buildFigureScene(payload.skeleton, { engaged: payload.engaged, stretched: payload.stretched }));

const grid = new GridHelper(2.4, 24, 0xd0d0d0, 0xe8e8e8);
grid.position.y = 0;
scene.add(grid);

scene.add(new AmbientLight(0xffffff, 1.1));
const key = new DirectionalLight(0xffffff, 1.6);
key.position.set(1.5, 2.5, 2);
scene.add(key);
const fill = new DirectionalLight(0xffffff, 0.5);
fill.position.set(-2, 1, -1.5);
scene.add(fill);

const target = [0, payload.skeleton.height / 2, 0] as const;

const camera = new PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.01, 50);
const az = payload.camera.azimuth * DEG;
const el = payload.camera.elevation * DEG;
camera.position.set(
  target[0] + DISTANCE * Math.sin(az) * Math.cos(el),
  target[1] + DISTANCE * Math.sin(el),
  target[2] + DISTANCE * Math.cos(az) * Math.cos(el),
);

const renderer = new WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(target[0], target[1], target[2]);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 0.3;
controls.maxDistance = 12;
controls.update();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});
