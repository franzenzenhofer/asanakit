import type { Group} from 'three';
import { AmbientLight, Color, DirectionalLight, GridHelper, PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { MuscleId } from '@asanakit/anatomy/muscles.js';
import type { Skeleton } from '@asanakit/core/types.js';
import type { Prop } from '@asanakit/model/schema.js';
import { buildFigureScene } from '@asanakit/three/scene.js';

export interface ViewerHandle {
  setFigure(skeleton: Skeleton, engaged: readonly MuscleId[], stretched: readonly MuscleId[], props: readonly Prop[]): void;
  dispose(): void;
}

/** One long-lived orbitable scene; the figure group swaps on every edit. */
export const createViewer = (mount: HTMLElement): ViewerHandle => {
  const scene = new Scene();
  scene.background = new Color('#ffffff');

  const camera = new PerspectiveCamera(38, 1, 0.01, 100);
  camera.position.set(0.9, 0.9, 2.1);

  scene.add(new AmbientLight(0xffffff, 1.15));
  const sun = new DirectionalLight(0xffffff, 1.6);
  sun.position.set(2, 4, 3);
  scene.add(sun);

  const grid = new GridHelper(4, 40, 0xd8d4ca, 0xeceae3);
  scene.add(grid);

  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  mount.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.5, 0);
  controls.enableDamping = true;
  controls.maxDistance = 8;
  controls.minDistance = 0.4;

  let figure: Group | null = null;
  let disposed = false;

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
    setFigure(skeleton, engaged, stretched, props): void {
      if (figure !== null) scene.remove(figure);
      figure = buildFigureScene(skeleton, { engaged: [...engaged], stretched: [...stretched], props: [...props] });
      scene.add(figure);
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
