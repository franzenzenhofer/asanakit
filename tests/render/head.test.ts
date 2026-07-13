import { Vector3 } from 'three';
import { describe, expect, test } from 'vitest';
import { headFrame } from '../../src/core/head.js';
import { DEFAULT_RIG } from '../../src/core/rig.js';
import { solveSkeleton } from '../../src/core/skeleton.js';
import type { KinematicPose } from '../../src/core/types.js';
import { parsePose } from '../../src/model/index.js';
import { renderSvg } from '../../src/render/index.js';
import { buildFigureScene } from '../../src/three/index.js';

const POSE = parsePose('asanakit: 2\nid: t\nname: T\ndiscipline: yoga\n', 't.pose.yaml');

const NEUTRAL: KinematicPose = {
  root: { position: [0, 0, 0], yaw: 0, pitch: 0, roll: 0, scale: 1 },
  joints: {},
  world: {},
  grounded: true,
};

const at = (azimuth: number): string => renderSvg(POSE, { camera: { azimuth, elevation: 0 } });

/** How much of the skull the occiput shade covers, as the polygon's area on the unit circle. */
const shadeArea = (svg: string): number => {
  const path = /data-part="occiput" d="M ([^"]+)"/.exec(svg);
  if (path === null) return 0;
  const pts = (path[1] ?? '')
    .replace(/ Z$/, '')
    .split(' L ')
    .map((p) => p.trim().split(/\s+/).map(Number) as [number, number]);
  // Shoelace, in the unit-circle space the path is authored in (pi = the whole skull).
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i] as [number, number];
    const b = pts[(i + 1) % pts.length] as [number, number];
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(sum) / 2 / Math.PI;
};


describe('the head looks somewhere, and the drawing says where', () => {
  test('facing the camera: no shade at all - you are looking at the face', () => {
    expect(shadeArea(at(0))).toBeLessThan(0.02);
  });

  test('facing away: the whole skull is shaded', () => {
    expect(shadeArea(at(180))).toBeGreaterThan(0.97);
  });

  test('in profile: exactly half the skull is shaded', () => {
    expect(shadeArea(at(90))).toBeCloseTo(0.5, 1);
  });

  test('the shade grows monotonically as the head turns away - a moon phase', () => {
    const areas = [0, 45, 90, 135, 180].map((a) => shadeArea(at(a)));
    for (let i = 1; i < areas.length; i++) {
      expect(areas[i] as number).toBeGreaterThan(areas[i - 1] as number);
    }
  });

  test('the two profiles are mirror images: the shade swaps sides', () => {
    expect(shadeArea(at(90))).toBeCloseTo(shadeArea(at(-90)), 3);
  });

  test('a turned head turns the shade with it, not the camera', () => {
    // Camera dead ahead, but the figure looks over its own left shoulder.
    const turned = parsePose(
      'asanakit: 2\nid: t\nname: T\ndiscipline: yoga\nfigure:\n  joints:\n    head: { twist: 70 }\n',
      't.pose.yaml',
    );
    expect(shadeArea(renderSvg(turned, { camera: 'front' }))).toBeGreaterThan(shadeArea(at(0)));
  });
});

describe('the 3D head agrees with the drawing', () => {
  test('the skull carries the head bone orientation, so its yaw is not arbitrary', () => {
    const skeleton = solveSkeleton({ ...NEUTRAL, joints: { head: { twist: 40 } } }, DEFAULT_RIG);
    const head = buildFigureScene(skeleton).children.find((c) => c.name === 'bone:head');
    const [x, y, z, w] = skeleton.bones.head.orientation;
    expect(head?.quaternion.x).toBeCloseTo(x, 8);
    expect(head?.quaternion.y).toBeCloseTo(y, 8);
    expect(head?.quaternion.z).toBeCloseTo(z, 8);
    expect(head?.quaternion.w).toBeCloseTo(w, 8);
  });

  test('it wears a nose and an occiput, and the nose is in front of the face', () => {
    const skeleton = solveSkeleton(NEUTRAL, DEFAULT_RIG);
    const head = buildFigureScene(skeleton).children.find((c) => c.name === 'bone:head');
    const names = head?.children.map((c) => c.name) ?? [];
    expect(names).toEqual(['head:skull', 'head:occiput', 'head:nose']);

    const nose = head?.children.find((c) => c.name === 'head:nose');
    expect(nose?.position.z).toBeGreaterThan(0); // local +z is the face
  });

  test('the nose in the scene is the nose in core/head.ts - one definition', () => {
    const skeleton = solveSkeleton({ ...NEUTRAL, joints: { head: { twist: 25 } } }, DEFAULT_RIG);
    const scene = buildFigureScene(skeleton);
    scene.updateMatrixWorld(true);
    const nose = scene.children
      .find((c) => c.name === 'bone:head')
      ?.children.find((c) => c.name === 'head:nose');
    const world = nose?.getWorldPosition(new Vector3()) as Vector3;

    // The mesh sits a little inside the nose tip so it reads as a bump, not a
    // spike - but on exactly the same ray out of exactly the same head centre.
    const frame = headFrame(skeleton);
    const centre = new Vector3(...frame.centre);
    const toMesh = world.clone().sub(centre).normalize();
    const toNose = new Vector3(...frame.nose).sub(centre).normalize();
    expect(toMesh.dot(toNose)).toBeCloseTo(1, 6);
  });
});
