import { describe, expect, test } from 'vitest';
import { CAMERA_PRESETS } from '../../src/core/camera.js';
import { rotateVec3 } from '../../src/core/quat.js';
import { DEFAULT_RIG } from '../../src/core/rig.js';
import { solveSkeleton } from '../../src/core/skeleton.js';
import type { KinematicPose } from '../../src/core/types.js';
import { parsePose } from '../../src/model/index.js';
import { matModel, surfboardModel, BOARD_WIDTH_RATIO, type MatProp, type SurfboardProp } from '../../src/props/geometry.js';
import { renderSvg, viewQuat } from '../../src/render/index.js';
import { exportGltf } from '../../src/export3d/index.js';
import { buildFigureScene } from '../../src/three/index.js';

const POSE: KinematicPose = {
  root: { position: [0, 0, 0], yaw: 0, pitch: 0, roll: 0, scale: 1 },
  joints: {},
  world: {},
  grounded: true,
};

const SKELETON = solveSkeleton(POSE, DEFAULT_RIG);

const mat = (over: Partial<MatProp> = {}): MatProp => ({
  type: 'mat',
  at: [0, 0],
  y: 0,
  width: 0.38,
  length: 1.35,
  thickness: 0.006,
  yaw: 0,
  ...over,
});

const board = (over: Partial<SurfboardProp> = {}): SurfboardProp => ({
  type: 'surfboard',
  under: ['ankleL', 'ankleR'],
  rotation: 0,
  length: 1.15,
  thickness: 0.024,
  offset: [0, 0],
  ...over,
});

describe('the mat is floor furniture, not a function of the body', () => {
  const armOut = (abduct: number): ReturnType<typeof solveSkeleton> =>
    solveSkeleton({ ...POSE, joints: { upperArmL: { abduct } } }, DEFAULT_RIG);

  test('moving an arm does not move the mat', () => {
    const down = matModel(mat(), armOut(0));
    const out = matModel(mat(), armOut(90));

    // Reaching the left arm out sideways stretches the figure's bounding box...
    expect(out.centre).not.toBe(down.centre); // (distinct objects, so the compare below is real)
    expect(armOut(90).bounds.maxX).toBeGreaterThan(armOut(0).bounds.maxX + 0.1);
    // ...and the mat, which lies on the floor, does not care in the slightest.
    expect(out.centre).toEqual(down.centre);
    expect(out.top).toEqual(down.top);
  });

  test('the mat sits where it is put, in world coordinates', () => {
    const m = matModel(mat({ at: [0.4, -0.25] }), SKELETON);
    expect(m.centre[0]).toBeCloseTo(0.4, 8);
    expect(m.centre[2]).toBeCloseTo(-0.25, 8);
  });

  test('the default mat is centred on the world origin, where the figure stands', () => {
    const m = matModel(mat(), SKELETON);
    expect(m.centre[0]).toBeCloseTo(0, 8);
    expect(m.centre[2]).toBeCloseTo(0, 8);
  });

  test('a real mat is about a centimetre thick, not four', () => {
    // 0.006 stature = ~1.1 cm on a 1.8 m figure.
    expect(mat().thickness).toBeLessThanOrEqual(0.006);
  });
});

describe('matModel - a configurable 3D yoga mat', () => {
  test('spans its width across x and its length along z', () => {
    const m = matModel(mat(), SKELETON);
    const xs = m.top.map((c) => c[0]);
    const zs = m.top.map((c) => c[2]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(0.38, 8);
    expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(1.35, 8);
  });

  test('yaw 90 swaps the axes: length runs along x', () => {
    const m = matModel(mat({ yaw: 90 }), SKELETON);
    const xs = m.top.map((c) => c[0]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(1.35, 8);
  });

  test('every dimension is configurable, and y is the TOP surface the figure lies on', () => {
    const m = matModel(mat({ width: 0.5, length: 2, thickness: 0.05 }), SKELETON);
    expect(m.width).toBe(0.5);
    expect(m.length).toBe(2);
    expect(m.top[0]?.[1]).toBeCloseTo(0, 8); // top at prop.y...
    expect(m.centre[1]).toBeCloseTo(-0.025, 8); // ...the box extends downward
  });
});

describe('surfboardModel - a configurable 3D surfboard', () => {
  test('centres under the named landmarks', () => {
    const m = surfboardModel(board(), SKELETON);
    const left = SKELETON.landmarks.ankleL;
    const right = SKELETON.landmarks.ankleR;
    expect(m.centre[0]).toBeCloseTo((left[0] + right[0]) / 2, 8);
  });

  test('width defaults to the shortboard plan and accepts an override', () => {
    expect(surfboardModel(board(), SKELETON).width).toBeCloseTo(1.15 * BOARD_WIDTH_RATIO, 8);
    expect(surfboardModel(board({ width: 0.5 }), SKELETON).width).toBe(0.5);
  });

  test('positive rotation lifts the nose', () => {
    const m = surfboardModel(board({ rotation: 20 }), SKELETON);
    const nose = m.outline[0] as readonly [number, number, number];
    const tailY = Math.min(...m.outline.map((p) => p[1]));
    expect(nose[1]).toBeGreaterThan(tailY);
    expect(nose[2]).toBeGreaterThan(m.centre[2]);
  });
});

describe('props in every output', () => {
  const POSE_YAML = [
    'asanakit: 2',
    'id: t',
    'name: T',
    'discipline: yoga',
    'props:',
    '  - type: mat',
    '    yaw: 90',
  ].join('\n');

  test('the three.js scene carries the prop meshes', () => {
    const pose = parsePose(POSE_YAML, 't.pose.yaml');
    const scene = buildFigureScene(SKELETON, { props: pose.props });
    expect(scene.children.map((c) => c.name)).toContain('prop:mat');
  });

  test('the GLB export carries the prop meshes', async () => {
    const pose = parsePose(POSE_YAML, 't.pose.yaml');
    const gltf = JSON.parse(await exportGltf(SKELETON, { props: pose.props })) as { nodes?: { name?: string }[] };
    expect((gltf.nodes ?? []).map((n) => n.name)).toContain('prop:mat');
  });

  test('the 2D mat is camera-aware: a profile sees the length, a front camera the width', () => {
    const span = (cameraId: 'right' | 'front'): number => {
      const q = viewQuat(CAMERA_PRESETS[cameraId]);
      const xs = matModel(mat(), SKELETON).top.map((corner) => rotateVec3(q, corner)[0]);
      return Math.max(...xs) - Math.min(...xs);
    };
    expect(span('right')).toBeCloseTo(1.35, 6);
    expect(span('front')).toBeCloseTo(0.38, 6);
  });
});

describe('left and right, told apart from the 3D model', () => {
  const pose = parsePose('asanakit: 2\nid: t\nname: T\ndiscipline: yoga\n', 't.pose.yaml');

  test('left bones take the left stroke, right bones the base stroke', () => {
    const svg = renderSvg(pose, { camera: 'side' });
    expect(svg).toMatch(/data-bone="thighL" data-side="left"[^/]*stroke="#6b6b6b"/);
    expect(svg).toMatch(/data-bone="thighR" data-side="right"[^/]*stroke="#111111"/);
  });

  test('the colors are configurable per render', () => {
    const svg = renderSvg(pose, { styleOverride: { figure: { strokeLeft: '#ff0000', stroke: '#00ff00' } } });
    expect(svg).toMatch(/data-bone="thighL"[^/]*stroke="#ff0000"/);
    expect(svg).toMatch(/data-bone="thighR"[^/]*stroke="#00ff00"/);
  });
});
