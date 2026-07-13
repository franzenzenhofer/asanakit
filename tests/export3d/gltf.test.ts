import { describe, expect, test } from 'vitest';
import { DEFAULT_RIG } from '../../src/core/rig.js';
import { solveSkeleton } from '../../src/core/skeleton.js';
import type { KinematicPose } from '../../src/core/types.js';
import { exportGlb, exportGltf } from '../../src/export3d/index.js';
import { buildFigureScene } from '../../src/three/index.js';

const POSE: KinematicPose = {
  root: { position: [0, 0, 0], yaw: 0, pitch: 0, roll: 0, scale: 1 },
  joints: { upperArmL: { abduct: 90 }, shinR: 45 },
  world: {},
  grounded: true,
};

const SKELETON = solveSkeleton(POSE, DEFAULT_RIG);

describe('buildFigureScene', () => {
  test('builds one named mesh per bone plus the joints', () => {
    const scene = buildFigureScene(SKELETON);
    const names = scene.children.map((c) => c.name);
    expect(names).toContain('bone:thighL');
    expect(names).toContain('bone:head');
    expect(names).toContain('joint:kneeL');
    // 20 capsules + head + 20 joint spheres.
    expect(names.filter((n) => n.startsWith("bone:"))).toHaveLength(21);
  });

  test('keeps the figure in solver space: y-up, feet on the floor, ~1 tall', () => {
    const scene = buildFigureScene(SKELETON);
    const head = scene.children.find((c) => c.name === 'bone:head');
    expect(head?.position.y).toBeGreaterThan(0.8);
    expect(head?.position.y).toBeLessThan(1.1);
  });

  test('paints engaged and stretched muscles on their bones', () => {
    const scene = buildFigureScene(SKELETON, { engaged: ['quadriceps'], stretched: ['biceps'] });
    const thigh = scene.children.find((c) => c.name === 'bone:thighL');
    const arm = scene.children.find((c) => c.name === 'bone:upperArmL');
    const spine = scene.children.find((c) => c.name === 'bone:spine');
    const color = (o: unknown): string =>
      `#${((o as { material: { color: { getHexString: () => string } } }).material.color.getHexString())}`;
    expect(color(thigh)).not.toBe(color(spine));
    expect(color(arm)).not.toBe(color(spine));
    expect(color(thigh)).not.toBe(color(arm));
  });
});

describe('exportGlb', () => {
  test('produces a valid GLB container', async () => {
    const glb = await exportGlb(SKELETON);
    expect(glb.toString('ascii', 0, 4)).toBe('glTF');
    expect(glb.readUInt32LE(4)).toBe(2); // glTF 2.0
    expect(glb.readUInt32LE(8)).toBe(glb.byteLength); // declared length matches
    expect(glb.byteLength % 4).toBe(0); // chunk alignment
  });

  test('contains a node for every bone', async () => {
    const gltf = JSON.parse(await exportGltf(SKELETON)) as { nodes?: { name?: string }[] };
    const names = (gltf.nodes ?? []).map((n) => n.name);
    expect(names).toContain('bone:thighL');
    expect(names).toContain('bone:head');
    expect(names.filter((n) => n?.startsWith("bone:"))).toHaveLength(21);
  });

  test('is deterministic: the same skeleton exports identical bytes', async () => {
    const a = await exportGlb(SKELETON);
    const b = await exportGlb(SKELETON);
    expect(a.equals(b)).toBe(true);
  });
});
