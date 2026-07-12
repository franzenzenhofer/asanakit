import { describe, expect, test } from 'vitest';
import { DEFAULT_RIG } from '../../src/core/rig.js';
import { solveSkeleton } from '../../src/core/skeleton.js';
import type { KinematicPose, Skeleton } from '../../src/core/types.js';
import { settleSkeleton } from '../../src/physics/settle.js';

const pose = (over: Partial<KinematicPose> = {}): KinematicPose => ({
  root: { position: [0, 0, 0], yaw: 0, pitch: 0, roll: 0, scale: 1 },
  joints: {},
  world: {},
  grounded: true,
  ...over,
});

const solve = (over: Partial<KinematicPose> = {}): Skeleton => solveSkeleton(pose(over), DEFAULT_RIG);

/** Bone centrelines rest one collider radius above the floor. */
const REST_TOLERANCE = 0.05;

describe('settleSkeleton', () => {
  test('is deterministic: two settles of the same pose are identical', async () => {
    const skeleton = solve({ joints: { spine: 20, upperArmL: { abduct: 45 } } });
    const a = await settleSkeleton(skeleton);
    const b = await settleSkeleton(skeleton);
    expect(a.landmarks).toEqual(b.landmarks);
    expect(a.bones).toEqual(b.bones);
  }, 30_000);

  test('leaves a balanced standing figure standing', async () => {
    const skeleton = solve();
    const settled = await settleSkeleton(skeleton);
    // Still upright: the head stays high, the feet stay low.
    expect(settled.landmarks.headTop[1]).toBeGreaterThan(0.85);
    expect(settled.bounds.minY).toBeGreaterThan(-0.01);
    expect(settled.bounds.minY).toBeLessThan(REST_TOLERANCE);
  }, 30_000);

  test('drops a floating figure onto the floor', async () => {
    // The root is the hip; the feet hang ~0.52 below it, so 0.8 floats them at ~0.28.
    const skeleton = solve({ root: { position: [0, 0.8, 0], yaw: 0, pitch: 0, roll: 0, scale: 1 }, grounded: false });
    const settled = await settleSkeleton(skeleton);
    expect(skeleton.bounds.minY).toBeGreaterThan(0.2);
    expect(settled.bounds.minY).toBeLessThan(REST_TOLERANCE);
    expect(settled.bounds.minY).toBeGreaterThan(-0.01);
  }, 30_000);

  test('rests a lying figure on its true support, not on a fake min-y shift', async () => {
    // A horizontal figure: pitch 90, arms at the sides. Its support is the
    // whole front of the body; every major landmark should end up near the
    // floor, not just the single lowest vertex.
    const skeleton = solve({ root: { position: [0, 0.2, 0], yaw: 0, pitch: 90, roll: 0, scale: 1 }, grounded: false });
    const settled = await settleSkeleton(skeleton);
    expect(settled.landmarks.chest[1]).toBeLessThan(0.2);
    expect(settled.landmarks.kneeL[1]).toBeLessThan(0.15);
    expect(settled.bounds.minY).toBeGreaterThan(-0.01);
  }, 30_000);

  test('preserves the authored pose exactly: only position and orientation change', async () => {
    const skeleton = solve({ joints: { shinL: 60, upperArmR: { abduct: 90 } } });
    const settled = await settleSkeleton(skeleton);
    const span = (s: Skeleton, a: 'kneeL' | 'ankleL', b: 'kneeL' | 'ankleL' | 'wristR'): number =>
      Math.hypot(
        s.landmarks[a][0] - s.landmarks[b][0],
        s.landmarks[a][1] - s.landmarks[b][1],
        s.landmarks[a][2] - s.landmarks[b][2],
      );
    // Rigid transform: every inter-landmark distance survives (to Rapier's
    // f32 precision - the readback quaternion carries ~1e-7).
    expect(span(settled, 'kneeL', 'ankleL')).toBeCloseTo(span(skeleton, 'kneeL', 'ankleL'), 6);
    expect(span(settled, 'ankleL', 'wristR')).toBeCloseTo(span(skeleton, 'ankleL', 'wristR'), 6);
  }, 30_000);
});
